import { ORPCError, os } from "@orpc/server";
import { currentTime, type AppContext } from "./base";

/**
 * Vérifications de mot de passe autorisées par utilisateur et par fenêtre glissante, toutes
 * procédures confondues (`account.changePassword`, `account.delete`). Elles passent par le routeur,
 * hors de la limite HTTP de better-auth, et chacune coûte un argon2id (19 Mio).
 */
export const PASSWORD_ATTEMPT_LIMIT = { max: 5, windowSeconds: 60 } as const;

/** Instants des derniers essais, par utilisateur (mémoire du processus, comme la limite de better-auth). */
const attempts = new Map<string, number[]>();

/** À placer après `userOnly` : refuse `TOO_MANY_REQUESTS` au-delà de la limite, avant toute vérification. */
export const limitPasswordAttempts = os
  .$context<AppContext & { user: { id: string } }>()
  .middleware(async ({ context, next }) => {
    const now = currentTime(context).getTime();
    const windowStart = now - PASSWORD_ATTEMPT_LIMIT.windowSeconds * 1000;
    const recent = (attempts.get(context.user.id) ?? []).filter((at) => at > windowStart);
    if (recent.length >= PASSWORD_ATTEMPT_LIMIT.max) {
      attempts.set(context.user.id, recent);
      throw new ORPCError("TOO_MANY_REQUESTS");
    }
    attempts.set(context.user.id, [...recent, now]);
    return next();
  });
