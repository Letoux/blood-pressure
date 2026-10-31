import { ORPCError } from "@orpc/server";
import { authed } from "./authed";

/**
 * Procédures sur les données d'un utilisateur (mesures…) : l'admin n'y a jamais accès (ADR-0004).
 * Provisoire : le ticket #4 ajoute la même garde `userOnly` dans `authed.ts`. Une fois fusionné,
 * importer `userOnly` depuis `./authed` et supprimer ce fichier.
 */
export const userOnly = authed.use(async ({ context, next }) => {
  if (context.user.role === "admin") throw new ORPCError("FORBIDDEN");
  return next();
});
