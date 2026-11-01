import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

describe("gestion des utilisateurs par l'admin", () => {
  let api: TestApi;
  let adminHeaders: Headers;

  async function createUser(email: string, name: string, password: string) {
    return api.as(adminHeaders).admin.createUser({ email, name, password });
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    adminHeaders = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("l'admin liste les utilisateurs avec leur email, nom, statut et date de création", async () => {
    const alice = await api.newUser("Alice");
    const bob = await api.newUser("Bob");

    const users = await api.as(adminHeaders).admin.listUsers();

    // D'autres tests créent aussi des utilisateurs : seuls ceux de ce test sont vérifiés.
    expect(users.filter((u) => u.id === alice.id || u.id === bob.id)).toEqual([
      { id: alice.id, email: alice.email, name: "Alice", status: "active", createdAt: expect.any(Date) },
      { id: bob.id, email: bob.email, name: "Bob", status: "active", createdAt: expect.any(Date) },
    ]);
    expect(users.map((u) => u.email)).not.toContain("admin@example.org");
  });

  it("un utilisateur désactivé perd ses sessions et ne peut plus se connecter", async () => {
    const carol = await createUser("carol@example.org", "Carol", "carol-password");
    const carolHeaders = await api.signIn("carol@example.org", "carol-password");

    await api.as(adminHeaders).admin.disableUser({ userId: carol.id });

    await expect(api.as(carolHeaders).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.signIn("carol@example.org", "carol-password")).rejects.toThrow();
    const users = await api.as(adminHeaders).admin.listUsers();
    expect(users.find((u) => u.id === carol.id)?.status).toBe("disabled");
  });

  it("un utilisateur réactivé peut de nouveau se connecter", async () => {
    const dave = await createUser("dave@example.org", "Dave", "dave-password");
    await api.as(adminHeaders).admin.disableUser({ userId: dave.id });

    await api.as(adminHeaders).admin.enableUser({ userId: dave.id });

    const daveHeaders = await api.signIn("dave@example.org", "dave-password");
    await expect(api.as(daveHeaders).me()).resolves.toMatchObject({ email: "dave@example.org" });
    const users = await api.as(adminHeaders).admin.listUsers();
    expect(users.find((u) => u.id === dave.id)?.status).toBe("active");
  });

  it("l'admin ne peut pas se désactiver lui-même", async () => {
    const admin = await api.as(adminHeaders).me();

    await expect(api.as(adminHeaders).admin.disableUser({ userId: admin.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(api.as(adminHeaders).me()).resolves.toMatchObject({ role: "admin" });
  });

  it("l'admin révoque les sessions d'un utilisateur, qui peut se reconnecter", async () => {
    const erin = await createUser("erin@example.org", "Erin", "erin-password");
    const phone = await api.signIn("erin@example.org", "erin-password");
    const laptop = await api.signIn("erin@example.org", "erin-password");

    await api.as(adminHeaders).admin.revokeSessions({ userId: erin.id });

    await expect(api.as(phone).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.as(laptop).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.signIn("erin@example.org", "erin-password")).resolves.toBeDefined();
  });

  it("après une réinitialisation, l'utilisateur se connecte avec le mot de passe temporaire et se voit proposer le changement", async () => {
    const frank = await createUser("frank@example.org", "Frank", "frank-password");
    const oldSession = await api.signIn("frank@example.org", "frank-password");
    await expect(api.as(oldSession).me()).resolves.toMatchObject({ passwordChangeSuggested: false });

    await api.as(adminHeaders).admin.resetPassword({ userId: frank.id, temporaryPassword: "temporaire-1" });

    await expect(api.as(oldSession).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.signIn("frank@example.org", "frank-password")).rejects.toThrow();
    const headers = await api.signIn("frank@example.org", "temporaire-1");
    await expect(api.as(headers).me()).resolves.toMatchObject({ passwordChangeSuggested: true });
  });

  it("refuse un mot de passe temporaire de moins de 10 caractères", async () => {
    const gina = await createUser("gina@example.org", "Gina", "gina-password");

    await expect(
      api.as(adminHeaders).admin.resetPassword({ userId: gina.id, temporaryPassword: "123456789" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.signIn("gina@example.org", "gina-password")).resolves.toBeDefined();
  });

  it("la suppression d'un utilisateur révoque ses sessions et le retire de la liste", async () => {
    const hugo = await createUser("hugo@example.org", "Hugo", "hugo-password");
    const hugoHeaders = await api.signIn("hugo@example.org", "hugo-password");

    await api.as(adminHeaders).admin.deleteUser({ userId: hugo.id });

    await expect(api.as(hugoHeaders).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.signIn("hugo@example.org", "hugo-password")).rejects.toThrow();
    const users = await api.as(adminHeaders).admin.listUsers();
    expect(users.map((u) => u.email)).not.toContain("hugo@example.org");
  });

  it("l'admin ne peut pas se supprimer lui-même", async () => {
    const admin = await api.as(adminHeaders).me();

    await expect(api.as(adminHeaders).admin.deleteUser({ userId: admin.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuse un utilisateur inconnu", async () => {
    await expect(api.as(adminHeaders).admin.disableUser({ userId: "inconnu" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
