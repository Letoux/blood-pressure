import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { ensureAdmin } from "./ensure-admin";

describe("admin initial défini par le .env", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("au premier démarrage, l'admin du .env peut se connecter", async () => {
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "mot-de-passe-1" });

    const headers = await api.signIn("admin@example.org", "mot-de-passe-1");

    await expect(api.as(headers).me()).resolves.toMatchObject({
      email: "admin@example.org",
      role: "admin",
    });
  });

  it("un nouveau ADMIN_PASSWORD est pris en compte au redémarrage", async () => {
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "mot-de-passe-2" });

    await expect(api.signIn("admin@example.org", "mot-de-passe-1")).rejects.toThrow();
    await expect(api.signIn("admin@example.org", "mot-de-passe-2")).resolves.toBeDefined();
  });

  it("un redémarrage sans changement garde l'admin utilisable", async () => {
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "mot-de-passe-2" });

    await expect(api.signIn("admin@example.org", "mot-de-passe-2")).resolves.toBeDefined();
  });
});
