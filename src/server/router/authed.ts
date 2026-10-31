import { ORPCError } from "@orpc/server";
import { base } from "./base";

/**
 * Procédures réservées à un appelant connecté. La lecture de la session prolonge
 * aussi son échéance (sessions glissantes de 180 jours, ADR-0009).
 */
export const authed = base.use(async ({ context, next }) => {
  const session = await context.auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { session: session.session, user: session.user } });
});

/**
 * Procédures sur les données d'un utilisateur (mesures, campagnes, réglages, compte rendu…) :
 * l'admin n'y a jamais accès (ADR-0004). `access.int.test.ts` le vérifie pour tout le routeur.
 */
export const userOnly = authed.use(async ({ context, next }) => {
  if (context.user.role === "admin") throw new ORPCError("FORBIDDEN");
  return next();
});

/** Procédures réservées à l'admin, qui n'accède jamais aux mesures (ADR-0004). */
export const adminOnly = authed.use(async ({ context, next }) => {
  if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN");
  return next();
});
