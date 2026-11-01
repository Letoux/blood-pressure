import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

/**
 * L'admin n'a jamais accès aux données de santé (ADR-0004). Les routes HTTP du plugin admin de
 * better-auth (`/api/auth/admin/*`) contournent le routeur oRPC et `userOnly` : aucune ne doit
 * répondre, en particulier `impersonate-user`, qui donnerait à l'admin la session d'un utilisateur.
 */
describe("routes HTTP du plugin admin de better-auth", () => {
  let api: TestApi;
  let adminCookie: string;
  let aliceId: string;

  /** Chemins `/admin/...` exposés par better-auth, avec leur méthode HTTP. */
  function adminEndpoints(): { path: string; method: string }[] {
    return Object.values(api.auth.api as Record<string, unknown>)
      .map((endpoint) => endpoint as { path?: string; options?: { method?: string | string[] } })
      .filter((endpoint) => endpoint.path?.startsWith("/admin/"))
      .map((endpoint) => {
        const method = endpoint.options?.method;
        return { path: endpoint.path!, method: (Array.isArray(method) ? method[0] : method) ?? "POST" };
      });
  }

  function request(path: string, method: string, body?: unknown): Promise<Response> {
    return api.auth.handler(
      new Request(`http://localhost:3000/api/auth${path}`, {
        method,
        headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie: adminCookie },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      }),
    );
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    const adminHeaders = await api.signIn("admin@example.org", "admin-password");
    adminCookie = adminHeaders.get("cookie")!;
    const alice = await api.as(adminHeaders).admin.createUser({
      email: "alice@example.org",
      name: "Alice",
      password: "alice-password",
    });
    aliceId = alice.id;
  });

  afterAll(async () => {
    await api.close();
  });

  it("l'admin ne peut pas prendre la session d'un utilisateur (impersonate-user)", async () => {
    const response = await request("/admin/impersonate-user", "POST", { userId: aliceId });

    expect([403, 404]).toContain(response.status);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("aucune route /api/auth/admin/* ne répond à l'admin", async () => {
    const endpoints = adminEndpoints();
    expect(endpoints.map((e) => e.path)).toContain("/admin/impersonate-user");

    for (const { path, method } of endpoints) {
      const response = await request(path, method, { userId: aliceId });
      expect([403, 404], `${method} ${path} → ${response.status}`).toContain(response.status);
    }
  });

  it("même appelé côté serveur, le rôle admin n'a pas la permission d'usurper un utilisateur", async () => {
    await expect(
      api.auth.api.impersonateUser({ headers: new Headers({ cookie: adminCookie }), body: { userId: aliceId } }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      api.auth.api.setRole({ headers: new Headers({ cookie: adminCookie }), body: { userId: aliceId, role: "admin" } }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
