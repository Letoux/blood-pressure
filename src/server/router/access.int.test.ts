import { createRouterClient, isProcedure } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { userOnly } from "./authed";
import { router } from "./index";

/**
 * Procédures que l'admin a le droit d'appeler. Elles ne touchent à aucune donnée de santé.
 * Toute autre procédure (mesures, campagnes, réglages, compte rendu…) doit partir de `userOnly`
 * et renvoyer « interdit » à l'admin (ADR-0004) : ce test le vérifie pour tout le routeur.
 * N'ajouter ici qu'une procédure qui ne lit ni n'écrit aucune donnée d'un utilisateur.
 */
const ADMIN_ALLOWED = new Set([
  "health",
  "me",
  "signUpOpen",
  "account.changePassword",
  "account.dismissPasswordChangeSuggestion",
  // Profil de l'appelant lui-même (nom, langue, thème) : l'admin règle aussi son interface.
  "settings.get",
  "settings.update",
]);

type Call = (input?: unknown) => Promise<unknown>;

/** Chemins (`admin.listUsers`) de toutes les procédures du routeur. */
function procedurePaths(node: object, prefix: string[] = []): string[][] {
  return Object.entries(node).flatMap(([key, value]) =>
    isProcedure(value) ? [[...prefix, key]] : procedurePaths(value as object, [...prefix, key]),
  );
}

function procedureAt(client: object, path: string[]): Call {
  return path.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], client) as Call;
}

const paths = procedurePaths(router);
const isAdminProcedure = (path: string[]) => path[0] === "admin";

describe("droits d'accès au routeur", () => {
  let api: TestApi;
  let adminHeaders: Headers;
  let userHeaders: Headers;

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    adminHeaders = await api.signIn("admin@example.org", "admin-password");
    await api.as(adminHeaders).admin.createUser({
      email: "alice@example.org",
      name: "Alice",
      password: "alice-password",
    });
    userHeaders = await api.signIn("alice@example.org", "alice-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("toute procédure hors gestion des comptes (mesures, campagnes…) est interdite à l'admin", async () => {
    const dataPaths = paths.filter((path) => !isAdminProcedure(path) && !ADMIN_ALLOWED.has(path.join(".")));
    for (const path of dataPaths) {
      await expect(procedureAt(api.as(adminHeaders), path)(), path.join(".")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("les procédures d'administration sont interdites à un utilisateur ordinaire", async () => {
    const adminPaths = paths.filter(isAdminProcedure);
    expect(adminPaths.length).toBeGreaterThan(0);
    for (const path of adminPaths) {
      await expect(procedureAt(api.as(userHeaders), path)(), path.join(".")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(procedureAt(api.client, path)(), path.join(".")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
  });

  it("`userOnly` refuse l'admin et l'anonyme, et laisse passer un utilisateur", async () => {
    const probe = { read: userOnly.handler(({ context }) => context.user.email) };
    const as = (headers: Headers) =>
      createRouterClient(probe, { context: { db: api.db, auth: api.auth, headers } });

    await expect(as(userHeaders).read()).resolves.toBe("alice@example.org");
    await expect(as(adminHeaders).read()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as(new Headers()).read()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
