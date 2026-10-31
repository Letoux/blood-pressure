import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PushMessage } from "@/lib/push-message";
import { ensureAdmin } from "@/server/auth/ensure-admin";
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

const device = (name: string) => ({
  endpoint: `https://push.example.org/send/${name}`,
  keys: { p256dh: `p256dh-${name}`, auth: `auth-${name}` },
});

describe("abonnement push et notification de test", () => {
  let api: TestApi;
  let alice: Headers;
  let bob: Headers;

  beforeAll(async () => {
    api = await createTestApi({ push: fakeSender });
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    const admin = await api.signIn("admin@example.org", "admin-password");
    for (const name of ["Alice", "Bob"]) {
      await api.as(admin).admin.createUser({
        email: `${name.toLowerCase()}@example.org`,
        name,
        password: `${name.toLowerCase()}-password`,
      });
    }
    alice = await api.signIn("alice@example.org", "alice-password");
    bob = await api.signIn("bob@example.org", "bob-password");
  });

  beforeEach(() => {
    delivered.length = 0;
    expired.clear();
  });

  afterAll(async () => {
    await api.close();
  });

  it("donne au navigateur la clé publique VAPID de l'instance", async () => {
    const { publicKey } = await ensureVapidKeys(api.db);
    await expect(api.as(alice).push.publicKey()).resolves.toEqual({ publicKey });
  });

  it("sans appareil abonné, la notification de test n'est envoyée nulle part", async () => {
    await expect(api.as(alice).push.sendTest()).resolves.toEqual({ sent: 0 });
    expect(delivered).toEqual([]);
  });

  it("envoie la notification de test à chaque appareil abonné de l'appelant, et seulement à lui", async () => {
    await api.as(alice).push.subscribe(device("alice-phone"));
    await api.as(alice).push.subscribe(device("alice-laptop"));
    await api.as(bob).push.subscribe(device("bob-phone"));

    await expect(api.as(alice).push.sendTest()).resolves.toEqual({ sent: 2 });
    expect(delivered.map(({ endpoint }) => endpoint).sort()).toEqual([
      "https://push.example.org/send/alice-laptop",
      "https://push.example.org/send/alice-phone",
    ]);
    // Dans la langue de l'utilisateur (ici celle du navigateur, à défaut de réglage), vers l'accueil.
    expect(delivered[0]!.message).toMatchObject({ title: "Tension", url: "/" });
    expect(delivered[0]!.message.body).toMatch(/notifications fonctionnent/);
  });

  it("le texte suit la langue des réglages", async () => {
    await api.as(bob).settings.update({ locale: "en" });
    await api.as(bob).push.sendTest();
    expect(delivered[0]!.message.body).toMatch(/Notifications are working/);
  });

  it("se réabonner avec le même appareil ne crée pas de doublon et met à jour ses clés", async () => {
    await api.as(alice).push.subscribe({ ...device("alice-phone"), keys: { p256dh: "nouvelle", auth: "cle" } });
    await api.as(alice).push.sendTest();
    expect(delivered).toHaveLength(2);
  });

  it("un appareil réabonné par un autre compte change de propriétaire", async () => {
    await api.as(bob).push.subscribe(device("alice-laptop"));
    await expect(api.as(alice).push.sendTest()).resolves.toEqual({ sent: 1 });
    await expect(api.as(bob).push.sendTest()).resolves.toEqual({ sent: 2 });
  });

  it("le désabonnement d'un appareil ne concerne que l'appelant", async () => {
    // Alice ne peut pas désabonner l'appareil de Bob.
    await api.as(alice).push.unsubscribe({ endpoint: device("bob-phone").endpoint });
    await api.as(alice).push.unsubscribe({ endpoint: device("alice-phone").endpoint });

    await expect(api.as(alice).push.sendTest()).resolves.toEqual({ sent: 0 });
    await expect(api.as(bob).push.sendTest()).resolves.toEqual({ sent: 2 });
  });

  it("un abonnement expiré est supprimé à l'envoi", async () => {
    expired.add(device("bob-phone").endpoint);
    await expect(api.as(bob).push.sendTest()).resolves.toEqual({ sent: 1 });
    expired.clear();
    await expect(api.as(bob).push.sendTest()).resolves.toEqual({ sent: 1 });
  });

  it("refuse un abonnement mal formé ou dont le service push n'est pas en HTTPS", async () => {
    for (const input of [
      { endpoint: "http://push.example.org/send/x", keys: { p256dh: "a", auth: "b" } },
      { endpoint: "pas une url", keys: { p256dh: "a", auth: "b" } },
      { endpoint: "https://push.example.org/send/x", keys: { p256dh: "", auth: "b" } },
      { endpoint: "https://push.example.org/send/x" },
    ]) {
      await expect(
        // @ts-expect-error valeurs invalides envoyées volontairement
        api.as(alice).push.subscribe(input),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(api.client.push.subscribe(device("x"))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.client.push.sendTest()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
