import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { account, user } from "@/server/db/schema";
import { cookieHeaders, createTestApi, type TestApi } from "@/server/testing/test-api";
import { SIGN_IN_RATE_LIMIT } from "./create-auth";
import { ensureAdmin } from "./ensure-admin";

const DAY = 24 * 60 * 60 * 1000;

describe("authentification", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    const adminHeaders = await api.signIn("admin@example.org", "admin-password");
    await api.as(adminHeaders).admin.createUser({
      email: "alice@example.org",
      name: "Alice",
      password: "alice-password",
    });
  });

  afterAll(async () => {
    await api.close();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("les procédures protégées refusent un appelant non authentifié", async () => {
    await expect(api.client.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("un utilisateur déconnecté n'a plus accès aux procédures protégées", async () => {
    const headers = await api.signIn("alice@example.org", "alice-password");
    await expect(api.as(headers).me()).resolves.toMatchObject({ email: "alice@example.org" });

    const response = await api.authRequest("/sign-out", { body: {}, headers });
    expect(response.ok).toBe(true);

    await expect(api.as(headers).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("stocke les mots de passe en argon2id", async () => {
    const [row] = await api.db
      .select({ password: account.password })
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(eq(user.email, "alice@example.org"));

    expect(row?.password).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
  });

  it("la session expire après 180 jours sans activité", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const headers = await api.signIn("alice@example.org", "alice-password");

    vi.setSystemTime(start + 179 * DAY);
    await expect(api.as(headers).me()).resolves.toBeDefined();

    const idle = await api.signIn("alice@example.org", "alice-password");
    vi.setSystemTime(start + 179 * DAY + 181 * DAY);
    await expect(api.as(idle).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("chaque utilisation repousse l'échéance de la session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const headers = await api.signIn("alice@example.org", "alice-password");

    vi.setSystemTime(start + 100 * DAY);
    await expect(api.as(headers).me()).resolves.toBeDefined();

    // 250 jours après la connexion, mais 150 jours après la dernière utilisation.
    vi.setSystemTime(start + 250 * DAY);
    await expect(api.as(headers).me()).resolves.toBeDefined();
  });

  it("limite les tentatives de connexion répétées", async () => {
    const attempt = () =>
      api.authRequest("/sign-in/email", {
        body: { email: "alice@example.org", password: "wrong-password" },
        headers: { "x-forwarded-for": "203.0.113.7" },
      });

    for (let i = 0; i < SIGN_IN_RATE_LIMIT.max; i++) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);

    // Même le bon mot de passe est refusé tant que la fenêtre n'est pas écoulée.
    const blocked = await api.authRequest("/sign-in/email", {
      body: { email: "alice@example.org", password: "alice-password" },
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    expect(blocked.status).toBe(429);
  });

  it("avec l'inscription libre désactivée, l'inscription publique est refusée", async () => {
    const response = await api.authRequest("/sign-up/email", {
      body: { email: "mallory@example.org", name: "Mallory", password: "mallory-password" },
    });

    expect(response.ok).toBe(false);
    await expect(api.signIn("mallory@example.org", "mallory-password")).rejects.toThrow();
  });
});

describe("inscription libre activée", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi({ allowSignUp: true });
  });

  afterAll(async () => {
    await api.close();
  });

  it("l'inscription publique crée un utilisateur connecté", async () => {
    const response = await api.authRequest("/sign-up/email", {
      body: { email: "carol@example.org", name: "Carol", password: "carol-password" },
    });
    expect(response.ok).toBe(true);

    await expect(api.as(cookieHeaders(response)).me()).resolves.toMatchObject({
      email: "carol@example.org",
      role: "user",
    });
  });

  it("refuse un mot de passe de moins de 10 caractères", async () => {
    const response = await api.authRequest("/sign-up/email", {
      body: { email: "dave@example.org", name: "Dave", password: "123456789" },
    });
    expect(response.status).toBe(400);
  });
});
