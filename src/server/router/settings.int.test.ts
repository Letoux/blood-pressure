import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

describe("settings", () => {
  let api: TestApi;
  let alice: Headers;
  let bob: Headers;

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    const admin = await api.signIn("admin@example.org", "admin-password");
    for (const name of ["Alice", "Bob"]) {
      await api.as(admin).admin.createUser({
        email: `${name.toLowerCase()}@example.org`,
        name,
        password: `${name.toLowerCase()}-password`,
      });
    }
    alice = await api.signIn("alice@example.org", "alice-password");
    bob = await api.signIn("bob@example.org", "bob-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("sans réglage enregistré : nom du compte, langue du navigateur, thème système", async () => {
    await expect(api.as(alice).settings.get()).resolves.toEqual({
      name: "Alice",
      locale: null,
      theme: "system",
    });
  });

  it("enregistre le nom affiché, la langue et le thème, et les relit à la session suivante", async () => {
    await expect(
      api.as(alice).settings.update({ name: "  Alice D.  ", locale: "en", theme: "dark" }),
    ).resolves.toEqual({ name: "Alice D.", locale: "en", theme: "dark" });

    const nextSession = await api.signIn("alice@example.org", "alice-password");
    await expect(api.as(nextSession).settings.get()).resolves.toEqual({
      name: "Alice D.",
      locale: "en",
      theme: "dark",
    });
    await expect(api.as(nextSession).me()).resolves.toMatchObject({ name: "Alice D." });
  });

  it("une mise à jour partielle ne touche pas aux autres réglages", async () => {
    await expect(api.as(alice).settings.update({ theme: "light" })).resolves.toEqual({
      name: "Alice D.",
      locale: "en",
      theme: "light",
    });
  });

  it("les réglages d'un utilisateur n'affectent pas ceux d'un autre", async () => {
    await expect(api.as(bob).settings.get()).resolves.toEqual({
      name: "Bob",
      locale: null,
      theme: "system",
    });
  });

  it("refuse un nom vide, une langue ou un thème inconnus", async () => {
    for (const input of [{ name: "   " }, { locale: "de" }, { theme: "sepia" }]) {
      await expect(
        // @ts-expect-error valeurs invalides envoyées volontairement
        api.as(bob).settings.update(input),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(api.client.settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.client.settings.update({ theme: "dark" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
