import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { MIN_PASSWORD_LENGTH } from "./password-policy";

export { MIN_PASSWORD_LENGTH };

const DAY_IN_SECONDS = 60 * 60 * 24;

/** Une session dure 180 jours sans activité (ADR-0009). */
export const SESSION_EXPIRES_IN_SECONDS = 180 * DAY_IN_SECONDS;

/** Connexions par email autorisées par adresse IP et par fenêtre. */
export const SIGN_IN_RATE_LIMIT = { window: 60, max: 5 } as const;

// argon2id (ADR-0009), paramètres recommandés par l'OWASP (19 Mio, 2 passes, 1 fil).
const ARGON2ID = 2; // `Algorithm.Argon2id` (enum `const` non importable avec isolatedModules).
const argon2Options = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export type AuthOptions = {
  db: Db;
  /** Secret de signature des cookies (`BETTER_AUTH_SECRET`). */
  secret: string;
  /** URL publique de l'application (`APP_URL`). */
  baseURL: string;
  /** Inscription libre (`ALLOW_SIGN_UP`), désactivée par défaut (ADR-0004). */
  allowSignUp?: boolean;
};

export function createAuth({ db, secret, baseURL, allowSignUp = false }: AuthOptions) {
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      password: {
        hash: (password) => hash(password, argon2Options),
        verify: ({ hash: digest, password }) => verify(digest, password),
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      // L'échéance est repoussée à 180 jours dès qu'une session sert après plus d'un jour :
      // chaque utilisation prolonge la session sans écrire en base à chaque requête.
      updateAge: DAY_IN_SECONDS,
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      customRules: { "/sign-in/email": { ...SIGN_IN_RATE_LIMIT } },
    },
    plugins: [admin()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
