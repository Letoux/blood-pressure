import { expect } from "@playwright/test";
import { test } from "./helpers";

// Nginx Proxy Manager n'ajoute aucun de ces en-têtes par défaut : l'app les envoie elle-même.
for (const path of ["/login", "/health", "/rpc/signUpOpen"]) {
  test(`en-têtes de sécurité sur ${path}`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();

    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("same-origin");
  });
}
