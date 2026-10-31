import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

describe("mot de passe de l'utilisateur", () => {
  let api: TestApi;
  let adminHeaders: Headers;

  /** Crée un utilisateur dont le mot de passe vient d'être réinitialisé par l'admin. */
  async function userAfterReset(email: string) {
    const created = await api.as(adminHeaders).admin.createUser({ email, name: "Test", password: "initial-password" });
    await api.as(adminHeaders).admin.resetPassword({ userId: created.id, temporaryPassword: "temporaire-1" });
    return api.signIn(email, "temporaire-1");
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    adminHeaders = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("l'utilisateur change son mot de passe en donnant l'ancien, et la proposition disparaît", async () => {
    const headers = await userAfterReset("alice@example.org");

    await api.as(headers).account.changePassword({
      currentPassword: "temporaire-1",
      newPassword: "nouveau-mot-de-passe",
    });

    await expect(api.as(headers).me()).resolves.toMatchObject({ passwordChangeSuggested: false });
    await expect(api.signIn("alice@example.org", "temporaire-1")).rejects.toThrow();
    await expect(api.signIn("alice@example.org", "nouveau-mot-de-passe")).resolves.toBeDefined();
  });

  it("refuse le changement si l'ancien mot de passe est faux", async () => {
    const headers = await userAfterReset("bob@example.org");

    await expect(
      api.as(headers).account.changePassword({ currentPassword: "mauvais-mdp", newPassword: "nouveau-mot-de-passe" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.signIn("bob@example.org", "temporaire-1")).resolves.toBeDefined();
  });

  it("refuse un nouveau mot de passe de moins de 10 caractères", async () => {
    const headers = await userAfterReset("carol@example.org");

    await expect(
      api.as(headers).account.changePassword({ currentPassword: "temporaire-1", newPassword: "123456789" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("l'utilisateur ferme le bandeau sans changer son mot de passe", async () => {
    const headers = await userAfterReset("dave@example.org");

    await api.as(headers).account.dismissPasswordChangeSuggestion();

    await expect(api.as(headers).me()).resolves.toMatchObject({ passwordChangeSuggested: false });
    const again = await api.signIn("dave@example.org", "temporaire-1");
    await expect(api.as(again).me()).resolves.toMatchObject({ passwordChangeSuggested: false });
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(
      api.client.account.changePassword({ currentPassword: "temporaire-1", newPassword: "nouveau-mot-de-passe" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
