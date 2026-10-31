import { os } from "@orpc/server";
import type { Db } from "@/server/db/client";

/** Contexte injecté dans chaque procédure. Les tests l'injectent avec une base jetable. */
export type AppContext = {
  db: Db;
};

export const base = os.$context<AppContext>();
