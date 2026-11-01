import { createECDH, randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import webpush from "web-push";
import { afterEach, describe, expect, it } from "vitest";
import { createWebPushTransport, PUSH_MAX_RESPONSE_BYTES, PUSH_SEND_TIMEOUT_MS } from "./transport";

/** Clés VAPID jetables, comme `ensureVapidKeys` en crée. */
function vapidDetails() {
  return { subject: "https://tension.example.org", ...webpush.generateVAPIDKeys() };
}

function subscription(endpoint: string): webpush.PushSubscription {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
  };
}

const servers: http.Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    }),
  );
});

/** Faux service push local, en HTTP. */
async function pushService(handler: http.RequestListener): Promise<string> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/send/abc`;
}

/**
 * Le transport tel qu'en production, sauf la connexion : HTTP vers 127.0.0.1, ce que `pushAgent`
 * refuse. Seuls les tests passent cette option.
 */
const localTransport = (limits: { timeoutMs?: number; maxResponseBytes?: number } = {}) =>
  createWebPushTransport({ connection: { agent: new http.Agent(), request: http.request }, ...limits });

const options = { vapidDetails: vapidDetails(), TTL: 60 };

describe("requête vers un service push (`createWebPushTransport`)", () => {
  it("garde les limites prévues en production : 10 s au total, quelques Kio de réponse", () => {
    expect(PUSH_SEND_TIMEOUT_MS).toBe(10_000);
    expect(PUSH_MAX_RESPONSE_BYTES).toBeLessThanOrEqual(16 * 1024);
  });

  it("envoie la requête signée et chiffrée de web-push, et renvoie le statut", async () => {
    const received: { method?: string; authorization?: string; encoding?: string; body: Buffer }[] = [];
    const endpoint = await pushService((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        received.push({
          method: req.method,
          authorization: req.headers.authorization,
          encoding: req.headers["content-encoding"],
          body: Buffer.concat(chunks),
        });
        res.writeHead(201).end();
      });
    });

    await expect(localTransport()(subscription(endpoint), '{"title":"Corps"}', options)).resolves.toEqual({
      statusCode: 201,
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ method: "POST", encoding: "aes128gcm" });
    expect(received[0]!.authorization).toMatch(/^vapid t=/);
    expect(received[0]!.body.length).toBeGreaterThan(0);
    expect(received[0]!.body.toString("utf8")).not.toContain("Corps");
  });

  it("lève une WebPushError avec le statut d'une réponse en échec (410 : abonnement expiré)", async () => {
    const endpoint = await pushService((_req, res) => res.writeHead(410).end("expiré"));

    const error = await localTransport()(subscription(endpoint), "{}", options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(webpush.WebPushError);
    expect(error).toMatchObject({ statusCode: 410, body: "expiré" });
  });

  it("abandonne au bout du délai total, même si le service envoie un octet de temps en temps", async () => {
    let closed = false;
    const endpoint = await pushService((req, res) => {
      req.resume();
      res.writeHead(201);
      const drip = setInterval(() => res.write("."), 20);
      res.on("close", () => {
        clearInterval(drip);
        closed = true;
      });
    });

    const started = Date.now();
    await expect(localTransport({ timeoutMs: 300 })(subscription(endpoint), "{}", options)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    await expect.poll(() => closed).toBe(true);
  });

  it("abandonne au bout du délai total si le service ne répond jamais", async () => {
    const endpoint = await pushService((req) => req.resume());

    const started = Date.now();
    await expect(localTransport({ timeoutMs: 300 })(subscription(endpoint), "{}", options)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("coupe une réponse trop longue au lieu de la lire en entier", async () => {
    let written = 0;
    let closed = false;
    const endpoint = await pushService((req, res) => {
      req.resume();
      res.writeHead(201);
      const chunk = Buffer.alloc(64 * 1024, "x");
      const pump = () => {
        while (!closed && written < 200 * 1024 * 1024) {
          written += chunk.length;
          if (!res.write(chunk)) return void res.once("drain", pump);
        }
        res.end();
      };
      res.on("close", () => (closed = true));
      pump();
    });

    await expect(
      localTransport({ maxResponseBytes: 4096 })(subscription(endpoint), "{}", options),
    ).rejects.toThrow(/trop longue/);
    await expect.poll(() => closed).toBe(true);
    expect(written).toBeLessThan(200 * 1024 * 1024);
  });

  it("par défaut, refuse de se connecter à un nom qui résout vers une adresse locale (pushAgent)", async () => {
    await expect(
      createWebPushTransport()(subscription("https://localhost:9/send/abc"), "{}", options),
    ).rejects.toThrow(/non publique/);
  });
});
