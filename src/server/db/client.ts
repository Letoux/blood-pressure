import path from "node:path";
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/** La base ou une transaction ouverte (`db.transaction(async (tx) => …)`). */
export type Queryable = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export type DbConnection = {
  db: Db;
  close: () => Promise<void>;
};

export function connectDb(databaseUrl: string): DbConnection {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}

/** Dossier des migrations SQL générées par drizzle-kit (`pnpm db:generate`). */
export const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
