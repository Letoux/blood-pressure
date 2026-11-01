import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

describe("admin.createUser", () => {
  let api: TestApi;
  let adminHeaders: Headers;

  /** Un email que seul le test qui l'appelle utilise. */
  const uniqueEmail = (name: string) => `${name}-${randomUUID()}@example.org`;

  beforeAll(async () => {
    api = await createTestApi();
    adminHeaders = await api.admin();
  });

  afterAll(async () => {
    await api.close();
  });

  it("l'admin crée un utilisateur, qui peut alors se connecter", async () => {
    const email = uniqueEmail("alice");
    const created = await api.as(adminHeaders).admin.createUser({ email, name: "Alice", password: "alice-password" });
    expect(created).toMatchObject({ email, name: "Alice" });

    const aliceHeaders = await api.signIn(email, "alice-password");
    await expect(api.as(aliceHeaders).me()).resolves.toMatchObject({ email, name: "Alice", role: "user" });
  });

  it("refuse un mot de passe de moins de 10 caractères", async () => {
    const email = uniqueEmail("bob");
    await expect(
      api.as(adminHeaders).admin.createUser({ email, name: "Bob", password: "123456789" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.signIn(email, "123456789")).rejects.toThrow();
  });

  it("refuse un email déjà utilisé", async () => {
    const alice = await api.newUser("Alice");
    await expect(
      api.as(adminHeaders).admin.createUser({ email: alice.email, name: "Alice bis", password: "another-password" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(
      api.client.admin.createUser({ email: uniqueEmail("eve"), name: "Eve", password: "eve-password" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuse un utilisateur qui n'est pas admin", async () => {
    const alice = await api.newUser("Alice");
    await expect(
      api.as(alice.headers).admin.createUser({ email: uniqueEmail("eve"), name: "Eve", password: "eve-password" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
