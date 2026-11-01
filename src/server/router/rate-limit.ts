import { ORPCError, os } from "@orpc/server";
import { currentTime, type AppContext } from "./base";

export type RateLimit = { readonly max: number; readonly windowSeconds: number };

/**
 * Middleware à placer après `userOnly` : au plus `max` appels par utilisateur sur une fenêtre
 * glissante de `windowSeconds`, refusés `TOO_MANY_REQUESTS` avant le traitement. Chaque appel à
 * cette fonction a son propre compteur (mémoire du processus, comme la limite de better-auth) :
 * plusieurs procédures partagent une limite en partageant le middleware.
 */
export function limitPerUser(limit: RateLimit) {
  /** Instants des derniers appels, par utilisateur. */
  const calls = new Map<string, number[]>();
  return os.$context<AppContext & { user: { id: string } }>().middleware(async ({ context, next }) => {
    const now = currentTime(context).getTime();
    const windowStart = now - limit.windowSeconds * 1000;
    const recent = (calls.get(context.user.id) ?? []).filter((at) => at > windowStart);
    if (recent.length >= limit.max) {
      calls.set(context.user.id, recent);
      throw new ORPCError("TOO_MANY_REQUESTS");
    }
    calls.set(context.user.id, [...recent, now]);
    return next();
  });
}
