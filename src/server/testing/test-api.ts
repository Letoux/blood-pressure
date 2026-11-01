import { randomUUID } from "node:crypto";
import { createRouterClient, type RouterClient } from "@orpc/server";
import pg from "pg";
import { createAuth, type Auth } from "@/server/auth/create-auth";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { connectDb, runMigrations, type Db } from "@/server/db/client";
import type { PushSender } from "@/server/push/sender";
import { router, type AppRouter } from "@/server/router";

/**
 * Harnais des tests d'intégration : une base Postgres jetable par suite, migrée,
 * et un client du routeur oRPC appelé côté serveur (sans HTTP).
 *
 * `TEST_DATABASE_URL` pointe vers un serveur Postgres avec un rôle autorisé à
 * créer des bases (par défaut, celui du `docker compose` de dev exposé en local).
 */
export type TestApi = {
  /** Client du routeur pour un appelant non authentifié. */
  client: RouterClient<AppRouter>;
  /**
   * Client du routeur pour l'appelant porteur de ces en-têtes (cookie de session), avec une
   * horloge fixée si `now` est fourni.
   */
  as: (headers: Headers, options?: { now?: Date }) => RouterClient<AppRouter>;
  /** Connexion par email et mot de passe ; renvoie les en-têtes portant le cookie de session. */
  signIn: (email: string, password: string) => Promise<Headers>;
  /** Requête HTTP vers les routes better-auth (`/api/auth/...`), comme le ferait un navigateur. */
  authRequest: (path: string, init?: { body?: unknown; headers?: HeadersInit }) => Promise<Response>;
  /** En-têtes de session de l'admin de la suite (`ADMIN_EMAIL`), créé au premier appel. */
  admin: () => Promise<Headers>;
  /**
   * Un utilisateur neuf, créé par l'admin, avec un email unique : chaque test a ses propres
   * utilisateurs et ne dépend pas de l'ordre des tests (`test:int` les mélange).
   */
  newUser: (name?: string) => Promise<TestUser>;
  auth: Auth;
  db: Db;
  close: () => Promise<void>;
};

export type TestUser = { id: string; name: string; email: string; password: string; headers: Headers };

/** Identifiants de l'admin des suites de tests. */
export const TEST_ADMIN = { email: "admin@example.org", password: "admin-password" } as const;

const DEFAULT_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";
const BASE_URL = "http://localhost:3000";

async function adminQuery(adminUrl: string, query: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

/** Transforme les `Set-Cookie` d'une réponse en en-tête `Cookie` d'une requête suivante. */
export function cookieHeaders(response: Response): Headers {
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  return new Headers({ cookie: cookies });
}

/** `push` : l'envoi des notifications injecté dans le contexte (un faux qui les enregistre). */
export async function createTestApi({ push }: { push?: PushSender } = {}): Promise<TestApi> {
  const adminUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_ADMIN_URL;
  const name = `bp_test_${randomUUID().replaceAll("-", "")}`;
  await adminQuery(adminUrl, `create database "${name}"`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const connection = connectDb(url.toString());
  await runMigrations(connection.db);

  const auth = createAuth({
    db: connection.db,
    secret: "test-secret-test-secret-test-secret",
    baseURL: BASE_URL,
  });
  const db = connection.db;
  const as: TestApi["as"] = (headers, options = {}) => {
    const { now } = options;
    return createRouterClient(router, {
      context: { db, auth, headers, push, now: now ? () => new Date(now) : undefined },
    });
  };

  const authRequest: TestApi["authRequest"] = (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    headers.set("origin", BASE_URL);
    return auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method: init.body === undefined ? "GET" : "POST",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );
  };

  const signIn: TestApi["signIn"] = async (email, password) => {
    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    if (!response.ok) throw new Error(`connexion refusée (${response.status})`);
    return cookieHeaders(response);
  };

  let adminSession: Promise<Headers> | null = null;
  const admin: TestApi["admin"] = () => {
    adminSession ??= ensureAdmin(auth, TEST_ADMIN).then(() => signIn(TEST_ADMIN.email, TEST_ADMIN.password));
    return adminSession;
  };

  const newUser: TestApi["newUser"] = async (name = "Test") => {
    const email = `${name.toLowerCase().replaceAll(/[^a-z0-9]/g, "")}-${randomUUID()}@example.org`;
    const password = `${name}-password-123`;
    const created = await as(await admin()).admin.createUser({ email, name, password });
    return { id: created.id, name, email, password, headers: await signIn(email, password) };
  };

  return {
    client: as(new Headers()),
    as,
    signIn,
    admin,
    newUser,
    authRequest,
    auth,
    db,
    close: async () => {
      await connection.close();
      await adminQuery(adminUrl, `drop database if exists "${name}" with (force)`);
    },
  };
}
