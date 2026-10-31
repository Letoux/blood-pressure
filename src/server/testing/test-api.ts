import { randomUUID } from "node:crypto";
import { createRouterClient, type RouterClient } from "@orpc/server";
import pg from "pg";
import { createAuth, type Auth } from "@/server/auth/create-auth";
import { connectDb, runMigrations, type Db } from "@/server/db/client";
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
  /** Client du routeur pour l'appelant porteur de ces en-têtes (cookie de session). */
  as: (headers: Headers) => RouterClient<AppRouter>;
  /** Connexion par email et mot de passe ; renvoie les en-têtes portant le cookie de session. */
  signIn: (email: string, password: string) => Promise<Headers>;
  /** Requête HTTP vers les routes better-auth (`/api/auth/...`), comme le ferait un navigateur. */
  authRequest: (path: string, init?: { body?: unknown; headers?: HeadersInit }) => Promise<Response>;
  auth: Auth;
  db: Db;
  close: () => Promise<void>;
};

export type TestApiOptions = {
  allowSignUp?: boolean;
};

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

export async function createTestApi(options: TestApiOptions = {}): Promise<TestApi> {
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
    allowSignUp: options.allowSignUp,
  });
  const db = connection.db;
  const as = (headers: Headers) => createRouterClient(router, { context: { db, auth, headers } });

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

  return {
    client: as(new Headers()),
    as,
    signIn: async (email, password) => {
      const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
      if (!response.ok) throw new Error(`connexion refusée (${response.status})`);
      return cookieHeaders(response);
    },
    authRequest,
    auth,
    db,
    close: async () => {
      await connection.close();
      await adminQuery(adminUrl, `drop database if exists "${name}" with (force)`);
    },
  };
}
