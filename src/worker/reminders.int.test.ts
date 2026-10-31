import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PushMessage } from "@/lib/push-message";
import { campaign, measurement, notification, pushSubscription, user, userSettings } from "@/server/db/schema";
import type { PushOutcome, PushSender, PushTarget } from "@/server/push/sender";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { runReminders } from "./reminders";

/** Un instant à une heure locale de Paris (hiver, UTC+1). */
const paris = (local: string) => new Date(`${local}:00+01:00`);

/**
 * Faux service push : enregistre chaque envoi. Un endpoint de `expired` répond « expiré » (410),
 * un endpoint de `failing` lève une erreur (service push injoignable).
 */
const delivered: { endpoint: string; message: PushMessage }[] = [];
const expired = new Set<string>();
const failing = new Set<string>();
const sender: PushSender = {
  send: async (target: PushTarget, message: PushMessage): Promise<PushOutcome> => {
    // Laisse les passages concurrents s'entrelacer, comme un vrai envoi réseau.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (failing.has(target.endpoint)) throw new Error("service push injoignable");
    if (expired.has(target.endpoint)) return "gone";
    delivered.push({ endpoint: target.endpoint, message });
    return "sent";
  },
};

const endpoint = (name: string) => `https://push.example.org/send/${name}`;

describe("tâche des rappels du worker", () => {
  let api: TestApi;

  async function addUser(
    id: string,
    {
      devices = [],
      settings,
      plannedStart = "2026-02-02",
    }: { devices?: string[]; settings?: Partial<typeof userSettings.$inferInsert>; plannedStart?: string | null },
  ) {
    await api.db.insert(user).values({ id, name: id, email: `${id}@example.org` });
    if (settings) await api.db.insert(userSettings).values({ userId: id, ...settings });
    for (const name of devices) {
      await api.db
        .insert(pushSubscription)
        .values({ userId: id, endpoint: endpoint(name), p256dh: `p256dh-${name}`, auth: `auth-${name}` });
    }
    if (plannedStart) await api.db.insert(campaign).values({ userId: id, plannedStart });
  }

  const journal = (userId: string) =>
    api.db
      .select({ channel: notification.channel, kind: notification.kind, date: notification.date, moment: notification.moment })
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(notification.sentAt);

  const subscriptions = async (userId: string) =>
    (
      await api.db
        .select({ endpoint: pushSubscription.endpoint })
        .from(pushSubscription)
        .where(eq(pushSubscription.userId, userId))
    ).map((row) => row.endpoint);

  beforeAll(async () => {
    api = await createTestApi();
    // Alice : deux appareils, en français, relance 30 minutes après.
    await addUser("alice", {
      devices: ["alice-phone", "alice-laptop"],
      settings: { locale: "fr", timeZone: "Europe/Paris", followUpEnabled: true, followUpDelayMinutes: 30 },
    });
    // Bob : en anglais, son seul appareil a expiré (410).
    await addUser("bob", { devices: ["bob-phone"], settings: { locale: "en", timeZone: "Europe/Paris" } });
    // Carole : aucun appareil abonné ; Dan : pas de campagne planifiée.
    await addUser("carole", {});
    await addUser("dan", { devices: ["dan-phone"], plannedStart: null });
    expired.add(endpoint("bob-phone"));
  });

  beforeEach(() => {
    delivered.length = 0;
    failing.clear();
  });

  afterAll(async () => {
    await api.close();
  });

  it("la veille d'une campagne, envoie le rappel de la veille dans la langue de chacun et le journalise", async () => {
    // Le rappel de la veille, à l'heure du soir (21:00 par défaut).
    await runReminders({ db: api.db, sender, now: paris("2026-02-01T20:59") });
    expect(delivered).toEqual([]);

    await runReminders({ db: api.db, sender, now: paris("2026-02-01T21:00") });
    expect(delivered.map((d) => d.endpoint).sort()).toEqual([endpoint("alice-laptop"), endpoint("alice-phone")]);
    expect(delivered[0]!.message).toMatchObject({ title: "Campagne demain", url: "/" });
    expect(await journal("alice")).toEqual([{ channel: "push", kind: "dayBefore", date: "2026-02-02", moment: null }]);
  });

  it("un abonnement expiré (410) est supprimé", async () => {
    expect(await subscriptions("bob")).toEqual([]);
    // Le rappel est tout de même journalisé : il n'y a plus rien à réessayer.
    expect(await journal("bob")).toEqual([{ channel: "push", kind: "dayBefore", date: "2026-02-02", moment: null }]);
    expect(await journal("carole")).toEqual([]);
    expect(await journal("dan")).toEqual([]);
  });

  it("le matin du premier jour, envoie le rappel du créneau ; relancée dans la même minute, la tâche n'envoie rien de plus", async () => {
    await runReminders({ db: api.db, sender, now: paris("2026-02-02T07:30") });
    expect(delivered).toHaveLength(2);
    expect(delivered[0]!.message).toEqual({
      title: "Mesures du matin",
      body: "C’est l’heure de vos 3 mesures (jour 1 sur 3).",
      url: "/entry",
      tag: "reminder-2026-02-02-morning",
    });

    await runReminders({ db: api.db, sender, now: paris("2026-02-02T07:30") });
    await runReminders({ db: api.db, sender, now: paris("2026-02-02T07:31") });
    expect(delivered).toHaveLength(2);
    expect(await journal("alice")).toHaveLength(2);
  });

  it("deux passages simultanés n'envoient la relance qu'une fois", async () => {
    const now = paris("2026-02-02T08:00");
    await Promise.all([
      runReminders({ db: api.db, sender, now }),
      runReminders({ db: api.db, sender, now }),
      runReminders({ db: api.db, sender, now }),
    ]);
    expect(delivered.map((d) => d.endpoint).sort()).toEqual([endpoint("alice-laptop"), endpoint("alice-phone")]);
    expect(delivered[0]!.message).toMatchObject({ title: "Mesures du matin", tag: "reminder-2026-02-02-morning" });
    expect((await journal("alice")).map((row) => row.kind)).toEqual(["dayBefore", "slot", "followUp"]);
  });

  it("rien pour un créneau rempli", async () => {
    const [alice] = await api.db.select({ id: campaign.id }).from(campaign).where(eq(campaign.userId, "alice"));
    await api.db.insert(measurement).values({
      userId: "alice",
      takenAt: paris("2026-02-02T20:00"),
      systolic: 130,
      diastolic: 80,
      pulse: 70,
      moment: "evening",
      campaignId: alice!.id,
      campaignDay: 1,
    });
    await runReminders({ db: api.db, sender, now: paris("2026-02-02T21:00") });
    expect(delivered).toEqual([]);
  });

  it("si l'envoi échoue sur tous les appareils, le rappel est réessayé au passage suivant", async () => {
    failing.add(endpoint("alice-phone"));
    failing.add(endpoint("alice-laptop"));
    await runReminders({ db: api.db, sender, now: paris("2026-02-03T07:30") });
    expect(delivered).toEqual([]);
    const slot = and(eq(notification.userId, "alice"), eq(notification.date, "2026-02-03"));
    expect(await api.db.select().from(notification).where(slot)).toEqual([]);

    failing.clear();
    await runReminders({ db: api.db, sender, now: paris("2026-02-03T07:31") });
    expect(delivered).toHaveLength(2);
    expect(delivered[0]!.message.body).toBe("C’est l’heure de vos 3 mesures (jour 2 sur 3).");
    expect(await api.db.select().from(notification).where(slot)).toHaveLength(1);
  });
});
