import { os } from "@orpc/server";
import type { Auth } from "@/server/auth/create-auth";
import type { Db } from "@/server/db/client";

/** Contexte injecté dans chaque procédure. Les tests l'injectent avec une base jetable. */
export type AppContext = {
  db: Db;
  auth: Auth;
  /** En-têtes de la requête : portent le cookie de session. */
  headers: Headers;
  /** Horloge : l'instant présent, injectable par les tests (défaut : `new Date()`). */
  now?: () => Date;
};

/** L'instant présent selon le contexte. */
export const currentTime = (context: Pick<AppContext, "now">): Date => context.now?.() ?? new Date();

export const base = os.$context<AppContext>();
