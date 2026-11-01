import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { PASSWORD_ATTEMPT_LIMIT } from "./password-attempts";

/**
 * `account.changePassword` et `account.delete` vérifient le mot de passe (argon2id, coûteux) hors
 * de la limite HTTP de better-auth : une session volée ne doit pas servir à le deviner en boucle.
 */
describe("limite des vérifications de mot de passe par utilisateur", () => {
  let api: TestApi;
  let admin: Headers;
  const start = new Date("2026-11-01T10:00:00Z");
  const later = (seconds: number) => new Date(start.getTime() + seconds * 1000);

  async function createUser(name: string) {
    const email = `${name.toLowerCase()}@example.org`;
    const password = `${name.toLowerCase()}-password`;
    await api.as(admin).admin.createUser({ email, name, password });
    return { email, password, headers: await api.signIn(email, password) };
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    admin = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("après trop d'essais, même le bon mot de passe est refusé jusqu'à la fin de la fenêtre", async () => {
    const ivy = await createUser("Ivy");
    const wrong = { currentPassword: "mauvais-mdp", newPassword: "nouveau-mot-de-passe" };
    for (let attempt = 0; attempt < PASSWORD_ATTEMPT_LIMIT.max; attempt++) {
      await expect(api.as(ivy.headers, { now: start }).account.changePassword(wrong)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }

    await expect(
      api.as(ivy.headers, { now: start }).account.changePassword({ ...wrong, currentPassword: ivy.password }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(api.as(ivy.headers, { now: start }).account.delete({ password: ivy.password })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(api.signIn(ivy.email, ivy.password)).resolves.toBeDefined();

    await api
      .as(ivy.headers, { now: later(PASSWORD_ATTEMPT_LIMIT.windowSeconds) })
      .account.changePassword({ ...wrong, currentPassword: ivy.password });
    await expect(api.signIn(ivy.email, "nouveau-mot-de-passe")).resolves.toBeDefined();
  });

  it("la limite est propre à chaque utilisateur", async () => {
    const jack = await createUser("Jack");
    const kate = await createUser("Kate");
    for (let attempt = 0; attempt <= PASSWORD_ATTEMPT_LIMIT.max; attempt++) {
      await api
        .as(jack.headers, { now: start })
        .account.delete({ password: "mauvais-mdp" })
        .catch(() => undefined);
    }

    await api.as(kate.headers, { now: start }).account.delete({ password: kate.password });
    await expect(api.signIn(kate.email, kate.password)).rejects.toThrow();
  });
});
