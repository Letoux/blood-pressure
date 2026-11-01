import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DueReminder } from "@/domain/reminder";
import type { PushMessage } from "@/lib/push-message";
import { campaign, measurement, notification, pushSubscription, user, userSettings } from "@/server/db/schema";
import type { PushOutcome, PushSender, PushTarget } from "@/server/push/sender";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { claimReminder, runReminders } from "./reminders";

/** Un instant à une heure locale de Paris (hiver, UTC+1). */
const paris = (local: string) => new Date(`${local}:00+01:00`);

/**
 * Faux service push, propre à chaque test : enregistre chaque envoi. Un endpoint de `expired`
 * répond « expiré » (410), un endpoint de `failing` lève une erreur (service push injoignable).
 */
function fakeSender() {
  const delivered: { endpoint: string; message: PushMessage }[] = [];
  const expired = new Set<string>();
  const failing = new Set<string>();
  const sender: PushSender = {
    send: async (target: PushTarget, message: PushMessage): Promise<PushOutcome> => {
      if (failing.has(target.endpoint)) throw new Error("service push injoignable");
      if (expired.has(target.endpoint)) return "gone";
      delivered.push({ endpoint: target.endpoint, message });
      return "sent";
    },
  };
  return { sender, delivered, expired, failing };
}

describe("tâche des rappels du worker", () => {
  let api: TestApi;

  /**
   * Un utilisateur neuf (identifiant unique), ses appareils abonnés (endpoints renvoyés), ses
   * réglages et sa campagne prévue (le 2 février 2026 par défaut ; `null` : aucune).
   */
  async function addUser({
    devices = ["phone"],
    settings = { timeZone: "Europe/Paris" },
    plannedStart = "2026-02-02",
  }: {
    devices?: string[];
    settings?: Partial<typeof userSettings.$inferInsert>;
    plannedStart?: string | null;
  } = {}) {
    const id = `user-${randomUUID()}`;
    await api.db.insert(user).values({ id, name: id, email: `${id}@example.org` });
    await api.db.insert(userSettings).values({ userId: id, ...settings });
    const endpoints = devices.map((name) => `https://push.example.org/send/${id}/${name}`);
    for (const endpoint of endpoints) {
      await api.db.insert(pushSubscription).values({ userId: id, endpoint, p256dh: "p256dh", auth: "auth" });
    }
    const [created] = plannedStart
      ? await api.db.insert(campaign).values({ userId: id, plannedStart }).returning({ id: campaign.id })
      : [];
    return { id, endpoints, campaignId: created?.id ?? null };
  }

  const journal = (userId: string) =>
    api.db
      .select({ kind: notification.kind, date: notification.date, moment: notification.moment })
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(notification.sentAt);

  /** Les envois reçus par ces appareils (la tâche passe sur tous les utilisateurs de la base). */
  const to = (delivered: { endpoint: string; message: PushMessage }[], endpoints: string[]) =>
    delivered.filter((d) => endpoints.includes(d.endpoint));

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("la veille d'une campagne, envoie le rappel de la veille sur chaque appareil, dans la langue de chacun", async () => {
    const alice = await addUser({ devices: ["phone", "laptop"], settings: { locale: "fr", timeZone: "Europe/Paris" } });
    const bob = await addUser({ settings: { locale: "en", timeZone: "Europe/Paris" } });
    const push = fakeSender();

    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-01T20:59") });
    expect(to(push.delivered, [...alice.endpoints, ...bob.endpoints])).toEqual([]);

    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-01T21:00") });
    const toAlice = to(push.delivered, alice.endpoints);
    expect(toAlice.map((d) => d.endpoint).sort()).toEqual([...alice.endpoints].sort());
    expect(toAlice[0]!.message).toMatchObject({ title: "Campagne demain", url: "/" });
    expect(to(push.delivered, bob.endpoints)[0]!.message.title).not.toBe("Campagne demain");
    expect(await journal(alice.id)).toEqual([{ kind: "dayBefore", date: "2026-02-02", moment: null }]);
  });

  it("un abonnement expiré (410) est supprimé, et le rappel journalisé", async () => {
    const carol = await addUser();
    const push = fakeSender();
    push.expired.add(carol.endpoints[0]!);
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-01T21:00") });
    const left = await api.db.select().from(pushSubscription).where(eq(pushSubscription.userId, carol.id));
    expect(left).toEqual([]);
    // Il n'y a plus rien à réessayer.
    expect(await journal(carol.id)).toEqual([{ kind: "dayBefore", date: "2026-02-02", moment: null }]);
  });

  it("rien pour un utilisateur sans appareil abonné, ni pour un utilisateur sans campagne", async () => {
    const withoutDevice = await addUser({ devices: [] });
    const withoutCampaign = await addUser({ plannedStart: null });
    const push = fakeSender();
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-01T21:00") });
    expect(to(push.delivered, withoutCampaign.endpoints)).toEqual([]);
    expect(await journal(withoutDevice.id)).toEqual([]);
    expect(await journal(withoutCampaign.id)).toEqual([]);
  });

  it("le matin du premier jour, envoie le rappel du créneau ; relancée dans la même minute, la tâche n'envoie rien de plus", async () => {
    const dan = await addUser({ devices: ["phone", "laptop"] });
    const push = fakeSender();
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T07:30") });
    const sent = to(push.delivered, dan.endpoints);
    expect(sent).toHaveLength(2);
    expect(sent[0]!.message).toEqual({
      title: "Mesures du matin",
      body: "C’est l’heure de vos 3 mesures (jour 1 sur 3).",
      url: "/entry",
      tag: "reminder-2026-02-02-morning",
    });

    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T07:30") });
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T07:31") });
    expect(to(push.delivered, dan.endpoints)).toHaveLength(2);
    expect(await journal(dan.id)).toEqual([{ kind: "slot", date: "2026-02-02", moment: "morning" }]);
  });

  it("la relance part après le délai choisi, une seule fois, sous le même tag que le rappel", async () => {
    const eve = await addUser({ settings: { timeZone: "Europe/Paris", followUpEnabled: true, followUpDelayMinutes: 30 } });
    const push = fakeSender();
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T08:00") });
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T08:01") });
    const sent = to(push.delivered, eve.endpoints);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message).toMatchObject({ title: "Mesures du matin", tag: "reminder-2026-02-02-morning" });
    expect(await journal(eve.id)).toEqual([{ kind: "followUp", date: "2026-02-02", moment: "morning" }]);
  });

  it("un passage qui perd la réservation d'un rappel (passage concurrent) ne l'envoie pas", async () => {
    const frank = await addUser();
    const push = fakeSender();
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T07:30"), claim: async () => null });
    expect(to(push.delivered, frank.endpoints)).toEqual([]);
  });

  it("rien pour un créneau rempli", async () => {
    const grace = await addUser();
    await api.db.insert(measurement).values({
      userId: grace.id,
      takenAt: paris("2026-02-02T20:00"),
      systolic: 130,
      diastolic: 80,
      pulse: 70,
      moment: "evening",
      campaignId: grace.campaignId,
      campaignDay: 1,
    });
    const push = fakeSender();
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T21:00") });
    expect(to(push.delivered, grace.endpoints)).toEqual([]);
  });

  it("si l'envoi échoue sur tous les appareils, le rappel est réessayé au passage suivant", async () => {
    const heidi = await addUser({ devices: ["phone", "laptop"] });
    const push = fakeSender();
    for (const endpoint of heidi.endpoints) push.failing.add(endpoint);
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T07:30") });
    expect(to(push.delivered, heidi.endpoints)).toEqual([]);
    expect(await journal(heidi.id)).toEqual([]);

    push.failing.clear();
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-02T07:31") });
    expect(to(push.delivered, heidi.endpoints)).toHaveLength(2);
    expect(await journal(heidi.id)).toHaveLength(1);
  });

  it("les rappels suivent la campagne de rattrapage d'une campagne manquée (ADR-0011)", async () => {
    const ivan = await addUser();
    const push = fakeSender();
    // Prévue le 2 février, sans mesure jusqu'au 8 : manquée, rattrapage le 9.
    await runReminders({ db: api.db, sender: push.sender, now: paris("2026-02-09T07:30") });
    const sent = to(push.delivered, ivan.endpoints);
    expect(sent.map((d) => d.message.tag)).toEqual(["reminder-2026-02-09-morning"]);
    expect(sent[0]!.message.body).toBe("C’est l’heure de vos 3 mesures (jour 1 sur 3).");
  });
});

describe("réservation d'un rappel (`claimReminder`)", () => {
  let api: TestApi;
  const reminder: DueReminder = { kind: "slot", date: "2026-02-02", moment: "morning", day: 1, key: "slot:2026-02-02:morning" };
  const now = paris("2026-02-02T07:30");

  async function newUserId() {
    const id = `user-${randomUUID()}`;
    await api.db.insert(user).values({ id, name: id, email: `${id}@example.org` });
    return id;
  }

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("le premier passage réserve le rappel, le second non", async () => {
    const userId = await newUserId();
    expect(await claimReminder(api.db, { userId, reminder, now })).toEqual(expect.any(String));
    expect(await claimReminder(api.db, { userId, reminder, now })).toBeNull();
  });

  it("de passages simultanés, un seul réserve le rappel", async () => {
    const userId = await newUserId();
    const claims = await Promise.all(
      Array.from({ length: 5 }, () => claimReminder(api.db, { userId, reminder, now })),
    );
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
  });

  it("un autre moment, un autre jour ou un autre utilisateur est un autre rappel", async () => {
    const userId = await newUserId();
    const other = await newUserId();
    await claimReminder(api.db, { userId, reminder, now });
    const evening: DueReminder = { ...reminder, moment: "evening", key: "slot:2026-02-02:evening" };
    const nextDay: DueReminder = { ...reminder, date: "2026-02-03", key: "slot:2026-02-03:morning" };
    expect(await claimReminder(api.db, { userId, reminder: evening, now })).not.toBeNull();
    expect(await claimReminder(api.db, { userId, reminder: nextDay, now })).not.toBeNull();
    expect(await claimReminder(api.db, { userId: other, reminder, now })).not.toBeNull();
    const rows = await api.db.select().from(notification).where(and(eq(notification.userId, userId)));
    expect(rows).toHaveLength(3);
  });
});
