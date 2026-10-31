import { os } from "@orpc/server";
import type { Auth } from "@/server/auth/create-auth";
import type { Db } from "@/server/db/client";

/** Contexte injecté dans chaque procédure. Les tests l'injectent avec une base jetable. */
export type AppContext = {
  db: Db;
  auth: Auth;
  /** En-têtes de la requête : portent le cookie de session. */
  headers: Headers;
};

export const base = os.$context<AppContext>();
