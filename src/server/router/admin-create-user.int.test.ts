import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

describe("admin.createUser", () => {
  let api: TestApi;
  let adminHeaders: Headers;

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    adminHeaders = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("l'admin crée un utilisateur, qui peut alors se connecter", async () => {
    const created = await api.as(adminHeaders).admin.createUser({
      email: "alice@example.org",
      name: "Alice",
      password: "alice-password",
    });
    expect(created).toMatchObject({ email: "alice@example.org", name: "Alice" });

    const aliceHeaders = await api.signIn("alice@example.org", "alice-password");
    await expect(api.as(aliceHeaders).me()).resolves.toMatchObject({
      email: "alice@example.org",
      name: "Alice",
      role: "user",
    });
  });

  it("refuse un mot de passe de moins de 10 caractères", async () => {
    await expect(
      api.as(adminHeaders).admin.createUser({
        email: "bob@example.org",
        name: "Bob",
        password: "123456789",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.signIn("bob@example.org", "123456789")).rejects.toThrow();
  });

  it("refuse un email déjà utilisé", async () => {
    await expect(
      api.as(adminHeaders).admin.createUser({
        email: "alice@example.org",
        name: "Alice bis",
        password: "another-password",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(
      api.client.admin.createUser({ email: "eve@example.org", name: "Eve", password: "eve-password" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuse un utilisateur qui n'est pas admin", async () => {
    const aliceHeaders = await api.signIn("alice@example.org", "alice-password");
    await expect(
      api
        .as(aliceHeaders)
        .admin.createUser({ email: "eve@example.org", name: "Eve", password: "eve-password" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
