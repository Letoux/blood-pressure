import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { ensureAdmin } from "./ensure-admin";

/**
 * Le compte admin vient du `.env` (ADR-0004) : changer `ADMIN_PASSWORD` ou `ADMIN_EMAIL` puis
 * redémarrer doit couper l'accès de quiconque détenait les anciens identifiants ou une session.
 */
describe("rotation des identifiants admin du .env", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("un redémarrage sans changement garde les sessions admin ouvertes", async () => {
    await ensureAdmin(api.auth, { email: "stable@example.org", password: "mot-de-passe-1" });
    const session = await api.signIn("stable@example.org", "mot-de-passe-1");

    await ensureAdmin(api.auth, { email: "stable@example.org", password: "mot-de-passe-1" });

    await expect(api.as(session).me()).resolves.toMatchObject({ role: "admin" });
  });

  it("un nouveau ADMIN_PASSWORD révoque les sessions admin ouvertes", async () => {
    await ensureAdmin(api.auth, { email: "stable@example.org", password: "mot-de-passe-1" });
    const session = await api.signIn("stable@example.org", "mot-de-passe-1");

    await ensureAdmin(api.auth, { email: "stable@example.org", password: "mot-de-passe-2" });

    await expect(api.as(session).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.signIn("stable@example.org", "mot-de-passe-2")).resolves.toBeDefined();
  });

  it("un nouveau ADMIN_EMAIL retire l'ancien compte admin et ses sessions", async () => {
    await ensureAdmin(api.auth, { email: "ancien@example.org", password: "ancien-mot-de-passe" });
    const oldSession = await api.signIn("ancien@example.org", "ancien-mot-de-passe");

    await ensureAdmin(api.auth, { email: "nouveau@example.org", password: "nouveau-mot-de-passe" });

    await expect(api.as(oldSession).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.signIn("ancien@example.org", "ancien-mot-de-passe")).rejects.toThrow();
    const newSession = await api.signIn("nouveau@example.org", "nouveau-mot-de-passe");
    await expect(api.as(newSession).me()).resolves.toMatchObject({ role: "admin" });
  });

  it("un utilisateur ordinaire n'est pas touché par le changement d'admin", async () => {
    await ensureAdmin(api.auth, { email: "nouveau@example.org", password: "nouveau-mot-de-passe" });
    const adminSession = await api.signIn("nouveau@example.org", "nouveau-mot-de-passe");
    await api.as(adminSession).admin.createUser({ email: "alice@example.org", name: "Alice", password: "alice-password" });
    const alice = await api.signIn("alice@example.org", "alice-password");

    await ensureAdmin(api.auth, { email: "autre@example.org", password: "autre-mot-de-passe" });

    await expect(api.as(alice).me()).resolves.toMatchObject({ email: "alice@example.org", role: "user" });
  });

  it("l'admin ne change pas son mot de passe dans l'app : celui du .env le remplacerait", async () => {
    await ensureAdmin(api.auth, { email: "autre@example.org", password: "autre-mot-de-passe" });
    const session = await api.signIn("autre@example.org", "autre-mot-de-passe");

    await expect(
      api.as(session).account.changePassword({
        currentPassword: "autre-mot-de-passe",
        newPassword: "mot-de-passe-de-l-app",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.signIn("autre@example.org", "autre-mot-de-passe")).resolves.toBeDefined();
  });
});
