import { limitPerUser } from "./rate-limit";

/**
 * Vérifications de mot de passe autorisées par utilisateur et par fenêtre glissante, toutes
 * procédures confondues (`account.changePassword`, `account.delete`). Elles passent par le routeur,
 * hors de la limite HTTP de better-auth, et chacune coûte un argon2id (19 Mio).
 */
export const PASSWORD_ATTEMPT_LIMIT = { max: 5, windowSeconds: 60 } as const;

/** À placer après `userOnly` : refuse `TOO_MANY_REQUESTS` au-delà de la limite, avant toute vérification. */
export const limitPasswordAttempts = limitPerUser(PASSWORD_ATTEMPT_LIMIT);
