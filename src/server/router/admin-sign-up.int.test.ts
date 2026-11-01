import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cookieHeaders, createTestApi, type TestApi } from "@/server/testing/test-api";

describe("inscription libre réglée par l'admin", () => {
  let api: TestApi;
  let adminHeaders: Headers;

  const signUp = (email: string) =>
    api.authRequest("/sign-up/email", { body: { email, name: "Test", password: "un-mot-de-passe" } });

  beforeAll(async () => {
    api = await createTestApi();
    adminHeaders = await api.admin();
  });

  afterAll(async () => {
    await api.close();
  });

  it("est fermée par défaut", async () => {
    // Réglage de l'instance : une base neuve, que les autres tests n'ont pas modifiée.
    const fresh = await createTestApi();
    try {
      await expect(fresh.client.signUpOpen()).resolves.toBe(false);
      await expect(fresh.as(await fresh.admin()).admin.getSettings()).resolves.toEqual({ signUpOpen: false });
      const response = await fresh.authRequest("/sign-up/email", {
        body: { email: "mallory@example.org", name: "Test", password: "un-mot-de-passe" },
      });
      expect(response.ok).toBe(false);
      await expect(fresh.signIn("mallory@example.org", "un-mot-de-passe")).rejects.toThrow();
    } finally {
      await fresh.close();
    }
  });

  it("une fois ouverte par l'admin, l'inscription publique crée un utilisateur connecté", async () => {
    await api.as(adminHeaders).admin.setSignUpOpen({ open: true });

    await expect(api.client.signUpOpen()).resolves.toBe(true);
    await expect(api.as(adminHeaders).admin.getSettings()).resolves.toEqual({ signUpOpen: true });
    const response = await signUp("carol@example.org");
    expect(response.ok).toBe(true);
    await expect(api.as(cookieHeaders(response)).me()).resolves.toMatchObject({
      email: "carol@example.org",
      role: "user",
    });
  });

  it("une fois refermée, l'inscription publique est de nouveau refusée", async () => {
    await api.as(adminHeaders).admin.setSignUpOpen({ open: true });
    await api.as(adminHeaders).admin.setSignUpOpen({ open: false });

    await expect(api.client.signUpOpen()).resolves.toBe(false);
    const response = await signUp("trent@example.org");
    expect(response.ok).toBe(false);
    await expect(api.signIn("trent@example.org", "un-mot-de-passe")).rejects.toThrow();
  });

  it("l'admin crée toujours des comptes quand l'inscription est fermée", async () => {
    await api.as(adminHeaders).admin.setSignUpOpen({ open: false });

    await api.as(adminHeaders).admin.createUser({
      email: "dave@example.org",
      name: "Dave",
      password: "dave-password",
    });
    await expect(api.signIn("dave@example.org", "dave-password")).resolves.toBeDefined();
  });
});
