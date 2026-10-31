import { randomUUID } from "node:crypto";
import { createRouterClient, type RouterClient } from "@orpc/server";
import pg from "pg";
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
  client: RouterClient<AppRouter>;
  db: Db;
  close: () => Promise<void>;
};

const DEFAULT_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";

async function adminQuery(adminUrl: string, query: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

export async function createTestApi(): Promise<TestApi> {
  const adminUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_ADMIN_URL;
  const name = `bp_test_${randomUUID().replaceAll("-", "")}`;
  await adminQuery(adminUrl, `create database "${name}"`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const connection = connectDb(url.toString());
  await runMigrations(connection.db);

  return {
    client: createRouterClient(router, { context: { db: connection.db } }),
    db: connection.db,
    close: async () => {
      await connection.close();
      await adminQuery(adminUrl, `drop database if exists "${name}" with (force)`);
    },
  };
}
