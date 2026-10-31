import { connectDb, runMigrations } from "@/server/db/client";
import { serverEnv } from "@/server/env";

// Applique les migrations Drizzle en attente. Lancé au démarrage du conteneur `app`.
async function main(): Promise<void> {
  const connection = connectDb(serverEnv().DATABASE_URL);
  try {
    await runMigrations(connection.db);
    console.log("[migrate] migrations appliquées");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error("[migrate] échec", error);
  process.exit(1);
});
