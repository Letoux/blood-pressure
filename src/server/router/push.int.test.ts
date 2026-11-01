import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PushMessage } from "@/lib/push-message";
import type { PushOutcome, PushTarget } from "@/server/push/sender";
import { ensureVapidKeys } from "@/server/push/vapid";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

/** Faux service push : enregistre chaque envoi ; un endpoint de `expired` répond « expiré ». */
const delivered: { endpoint: string; message: PushMessage }[] = [];
const expired = new Set<string>();
const fakeSender = {
  send: async (target: PushTarget, message: PushMessage): Promise<PushOutcome> => {
    if (expired.has(target.endpoint)) return "gone";
    delivered.push({ endpoint: target.endpoint, message });
    return "sent";
  },
};

/** Un appareil neuf (endpoint unique), propre au test qui le crée. */
const newDevice = () => {
  const name = randomUUID();
  return { endpoint: `https://push.example.org/send/${name}`, keys: { p256dh: `p256dh-${name}`, auth: `auth-${name}` } };
};

describe("abonnement push et notification de test", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi({ push: fakeSender });
  });

  beforeEach(() => {
    delivered.length = 0;
    expired.clear();
  });

  afterAll(async () => {
    await api.close();
  });

  it("donne au navigateur la clé publique VAPID de l'instance", async () => {
    const alice = await api.newUser("Alice");
    const { publicKey } = await ensureVapidKeys(api.db);
    await expect(api.as(alice.headers).push.publicKey()).resolves.toEqual({ publicKey });
  });

  it("sans appareil abonné, la notification de test n'est envoyée nulle part", async () => {
    const alice = await api.newUser("Alice");
    await expect(api.as(alice.headers).push.sendTest()).resolves.toEqual({ sent: 0 });
    expect(delivered).toEqual([]);
  });

  it("envoie la notification de test à chaque appareil abonné de l'appelant, et seulement à lui", async () => {
    const alice = await api.newUser("Alice");
    const bob = await api.newUser("Bob");
    const [phone, laptop, bobPhone] = [newDevice(), newDevice(), newDevice()];
    await api.as(alice.headers).push.subscribe(phone);
    await api.as(alice.headers).push.subscribe(laptop);
    await api.as(bob.headers).push.subscribe(bobPhone);

    await expect(api.as(alice.headers).push.sendTest()).resolves.toEqual({ sent: 2 });
    expect(delivered.map(({ endpoint }) => endpoint).sort()).toEqual([phone.endpoint, laptop.endpoint].sort());
    // Dans la langue de l'utilisateur (ici celle du navigateur, à défaut de réglage), vers l'accueil.
    expect(delivered[0]!.message).toMatchObject({ title: "Tension", url: "/" });
    expect(delivered[0]!.message.body).toMatch(/notifications fonctionnent/);
  });

  it("le texte suit la langue des réglages", async () => {
    const bob = await api.newUser("Bob");
    await api.as(bob.headers).push.subscribe(newDevice());
    await api.as(bob.headers).settings.update({ locale: "en" });
    await api.as(bob.headers).push.sendTest();
    expect(delivered[0]!.message.body).toMatch(/Notifications are working/);
  });

  it("se réabonner avec le même appareil ne crée pas de doublon et met à jour ses clés", async () => {
    const alice = await api.newUser("Alice");
    const phone = newDevice();
    await api.as(alice.headers).push.subscribe(phone);
    await api.as(alice.headers).push.subscribe({ ...phone, keys: { p256dh: "nouvelle", auth: "cle" } });
    await expect(api.as(alice.headers).push.sendTest()).resolves.toEqual({ sent: 1 });
    expect(delivered).toHaveLength(1);
  });

  it("un appareil réabonné par un autre compte change de propriétaire", async () => {
    const alice = await api.newUser("Alice");
    const bob = await api.newUser("Bob");
    const [laptop, phone] = [newDevice(), newDevice()];
    await api.as(alice.headers).push.subscribe(laptop);
    await api.as(alice.headers).push.subscribe(phone);
    await api.as(bob.headers).push.subscribe(laptop);
    await expect(api.as(alice.headers).push.sendTest()).resolves.toEqual({ sent: 1 });
    await expect(api.as(bob.headers).push.sendTest()).resolves.toEqual({ sent: 1 });
  });

  it("le désabonnement d'un appareil ne concerne que l'appelant", async () => {
    const alice = await api.newUser("Alice");
    const bob = await api.newUser("Bob");
    const [alicePhone, bobPhone] = [newDevice(), newDevice()];
    await api.as(alice.headers).push.subscribe(alicePhone);
    await api.as(bob.headers).push.subscribe(bobPhone);
    // Alice ne peut pas désabonner l'appareil de Bob.
    await api.as(alice.headers).push.unsubscribe({ endpoint: bobPhone.endpoint });
    await api.as(alice.headers).push.unsubscribe({ endpoint: alicePhone.endpoint });

    await expect(api.as(alice.headers).push.sendTest()).resolves.toEqual({ sent: 0 });
    await expect(api.as(bob.headers).push.sendTest()).resolves.toEqual({ sent: 1 });
  });

  it("un abonnement expiré est supprimé à l'envoi", async () => {
    const bob = await api.newUser("Bob");
    const [phone, laptop] = [newDevice(), newDevice()];
    await api.as(bob.headers).push.subscribe(phone);
    await api.as(bob.headers).push.subscribe(laptop);
    expired.add(phone.endpoint);
    await expect(api.as(bob.headers).push.sendTest()).resolves.toEqual({ sent: 1 });
    expired.clear();
    delivered.length = 0;
    await expect(api.as(bob.headers).push.sendTest()).resolves.toEqual({ sent: 1 });
    expect(delivered.map((d) => d.endpoint)).toEqual([laptop.endpoint]);
  });

  it.each([
    ["un service push en HTTP", { endpoint: "http://push.example.org/send/x", keys: { p256dh: "a", auth: "b" } }],
    ["un endpoint qui n'est pas une URL", { endpoint: "pas une url", keys: { p256dh: "a", auth: "b" } }],
    ["une clé vide", { endpoint: "https://push.example.org/send/x", keys: { p256dh: "", auth: "b" } }],
    ["un abonnement sans clés", { endpoint: "https://push.example.org/send/x" }],
  ])("refuse %s", async (_label, input) => {
    const alice = await api.newUser("Alice");
    await expect(
      // @ts-expect-error valeurs invalides envoyées volontairement
      api.as(alice.headers).push.subscribe(input),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(api.client.push.subscribe(newDevice())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.client.push.sendTest()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
