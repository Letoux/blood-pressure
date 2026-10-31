import { connectDb, type Db } from "./client";
import { serverEnv } from "@/server/env";

let connection: ReturnType<typeof connectDb> | undefined;

/** Connexion partagée du processus (app ou worker), ouverte au premier appel. */
export function getDb(): Db {
  connection ??= connectDb(serverEnv().DATABASE_URL);
  return connection.db;
}

/** Ferme la connexion partagée (arrêt du worker). */
export async function closeDb(): Promise<void> {
  const open = connection;
  connection = undefined;
  await open?.close();
}
