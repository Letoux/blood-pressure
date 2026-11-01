import type { LookupAddress } from "node:dns";
import https from "node:https";
import { describe, expect, it } from "vitest";
import { createPublicOnlyLookup, isAllowedPushEndpoint, pushAgent } from "./endpoint";

describe("adresse d'un service push (protection SSRF)", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://142.250.74.234/send/abc",
  ])("accepte un service public : %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["http (non chiffré)", "http://fcm.googleapis.com/fcm/send/abc"],
    ["IP privée", "https://192.168.1.10:8443/whatever"],
    ["IP privée 10/8", "https://10.0.0.5/x"],
    ["IP privée 172.16/12", "https://172.20.0.3/x"],
    ["boucle locale", "https://127.0.0.1/x"],
    ["lien local (métadonnées cloud)", "https://169.254.169.254/latest"],
    ["IPv6 boucle locale", "https://[::1]/x"],
    ["IPv6 unique locale", "https://[fd00::1]/x"],
    ["IPv6 lien local", "https://[fe80::1]/x"],
    ["IPv4 mappée en IPv6", "https://[::ffff:192.168.1.10]/x"],
    ["0.0.0.0", "https://0.0.0.0/x"],
    ["localhost", "https://localhost/x"],
    ["sous-domaine de localhost", "https://push.localhost/x"],
    ["nom sans domaine (réseau local)", "https://nas/x"],
    ["nom mDNS", "https://nas.local/x"],
    ["nom de réseau maison", "https://router.home.arpa/x"],
    ["IP en notation entière", "https://3232235786/x"],
    ["pas une URL", "pas une url"],
  ])("refuse %s", (_label, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe("résolution DNS limitée aux adresses publiques", () => {
  const resolvingTo =
    (...addresses: string[]) =>
    (_host: string, _options: object, callback: (error: Error | null, addresses: LookupAddress[]) => void) =>
      callback(
        null,
        addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
      );

  function lookup(resolver: ReturnType<typeof resolvingTo>, host = "push.example.org") {
    const publicOnly = createPublicOnlyLookup(resolver);
    return new Promise<{ error: Error | null; address: unknown }>((resolve) =>
      publicOnly(host, {}, (error, address) => resolve({ error, address })),
    );
  }

  it("laisse passer un nom qui résout vers une adresse publique", async () => {
    const { error, address } = await lookup(resolvingTo("142.250.74.234"));
    expect(error).toBeNull();
    expect(address).toBe("142.250.74.234");
  });

  it("refuse un nom public qui résout vers une adresse privée (rebinding, nip.io…)", async () => {
    const { error } = await lookup(resolvingTo("192.168.1.10"));
    expect(error?.message).toMatch(/non publique/);
  });

  it("l'agent des envois push refuse de se connecter à un nom qui résout en local", async () => {
    const error = await new Promise<Error>((resolve) => {
      https.get("https://localhost:9/", { agent: pushAgent }, () => resolve(new Error("connecté"))).on("error", resolve);
    });
    expect(error.message).toMatch(/non publique/);
  });

  it("refuse dès qu'une des adresses résolues n'est pas publique", async () => {
    const { error } = await lookup(resolvingTo("142.250.74.234", "127.0.0.1"));
    expect(error).not.toBeNull();
  });
});
