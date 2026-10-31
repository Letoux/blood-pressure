import { createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { createWebPushSender, type WebPushTransport } from "./sender";
import { ensureVapidKeys } from "./vapid";

/** Un abonnement comme en produit un navigateur (clé P-256 et secret d'authentification). */
function browserSubscription(endpoint = "https://push.example.org/send/abc") {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint,
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

const message = { title: "Titre", body: "Corps", url: "/entry" };

describe("envoi Web Push (`createWebPushSender`)", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("signe avec les clés VAPID de la base et chiffre le message pour l'appareil", async () => {
    const keys = await ensureVapidKeys(api.db);
    const requests: ReturnType<typeof webpush.generateRequestDetails>[] = [];
    const transport: WebPushTransport = async (subscription, payload, options) => {
      // La vraie requête que `web-push` enverrait au service push du navigateur.
      requests.push(webpush.generateRequestDetails(subscription, payload, options));
      expect(JSON.parse(payload)).toEqual(message);
      return { statusCode: 201 };
    };
    const sender = createWebPushSender({ db: api.db, subject: "https://tension.example.org", transport });

    await expect(sender.send(browserSubscription(), message)).resolves.toBe("sent");

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request!.endpoint).toBe("https://push.example.org/send/abc");
    expect(request!.headers.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`));
    expect(request!.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(Number(request!.headers.TTL)).toBeGreaterThan(0);
    // Chiffré : le texte du message n'apparaît pas dans le corps.
    expect(Buffer.from(request!.body!).toString("utf8")).not.toContain("Corps");

    // Le jeton VAPID désigne bien le service push de l'appareil et l'instance.
    const jwt = request!.headers.Authorization!.split(" ")[1]!.slice(2, -1);
    const claims = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString());
    expect(claims).toMatchObject({ aud: "https://push.example.org", sub: "https://tension.example.org" });
  });

  it("signale un abonnement expiré (404 ou 410) et laisse remonter les autres erreurs", async () => {
    const failing = (statusCode: number): WebPushTransport => async () => {
      throw new webpush.WebPushError("refusé", statusCode, {}, "", "https://push.example.org/send/abc");
    };
    const subject = "mailto:admin@example.org";

    for (const statusCode of [404, 410]) {
      const sender = createWebPushSender({ db: api.db, subject, transport: failing(statusCode) });
      await expect(sender.send(browserSubscription(), message)).resolves.toBe("gone");
    }
    const sender = createWebPushSender({ db: api.db, subject, transport: failing(500) });
    await expect(sender.send(browserSubscription(), message)).rejects.toThrow("refusé");
  });
});
