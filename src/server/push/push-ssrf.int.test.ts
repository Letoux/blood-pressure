import { createECDH, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { createWebPushSender, type WebPushTransport } from "./sender";

/** Clés d'abonnement valides, comme en produit un navigateur. */
function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
}

const message = { title: "Titre", body: "Corps", url: "/entry" };

describe("envois push vers le réseau local de l'instance (SSRF)", () => {
  let api: TestApi;
  let alice: Headers;

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    const admin = await api.signIn("admin@example.org", "admin-password");
    await api.as(admin).admin.createUser({ email: "alice@example.org", name: "Alice", password: "alice-password" });
    alice = await api.signIn("alice@example.org", "alice-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("push.subscribe refuse une adresse du réseau local", async () => {
    for (const endpoint of [
      "https://192.168.1.10:8443/whatever",
      "https://localhost/x",
      "https://[::1]/x",
      "https://nas.local/x",
    ]) {
      await expect(api.as(alice).push.subscribe({ endpoint, keys: browserKeys() }), endpoint).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  });

  it("push.subscribe accepte le service push d'un navigateur", async () => {
    await expect(
      api.as(alice).push.subscribe({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: browserKeys() }),
    ).resolves.toBeUndefined();
  });

  it("l'envoi ignore un abonnement local déjà en base, qui est alors supprimé comme expiré", async () => {
    const calls: string[] = [];
    const transport: WebPushTransport = async (subscription) => {
      calls.push(subscription.endpoint);
      return { statusCode: 201 };
    };
    const sender = createWebPushSender({ db: api.db, subject: "https://tension.example.org", transport });

    await expect(sender.send({ endpoint: "https://10.0.0.5/x", ...browserKeys() }, message)).resolves.toBe("gone");
    expect(calls).toEqual([]);
  });
});
