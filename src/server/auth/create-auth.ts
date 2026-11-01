import { hash, verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { getAppSettings } from "@/server/settings/app-settings";
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

/**
 * Droits du rôle admin dans better-auth : seulement ce que les procédures `admin.*` appellent
 * côté serveur (créer, désactiver, supprimer, réinitialiser, révoquer). Ni `impersonate`, qui
 * donnerait à l'admin la session d'un utilisateur et donc ses mesures (ADR-0004), ni `set-role`,
 * `update`, `set-email` ou `get`.
 */
const accessControl = createAccessControl(defaultStatements);
const roles = {
  admin: accessControl.newRole({
    user: ["create", "list", "ban", "delete", "set-password"],
    session: ["revoke"],
  }),
  user: accessControl.newRole({ user: [], session: [] }),
};

const adminPlugin = () => admin({ ac: accessControl, roles });

/**
 * Routes HTTP du plugin admin (`/api/auth/admin/*`), toutes fermées : l'interface passe par les
 * procédures `admin.*` du routeur oRPC, qui appellent `auth.api.*` côté serveur. `disabledPaths`
 * ne ferme que le gestionnaire HTTP, pas ces appels (vérifié par `admin-routes.int.test.ts`).
 */
const ADMIN_HTTP_PATHS = Object.values(adminPlugin().endpoints).map((endpoint) => endpoint.path);

export type AuthOptions = {
  db: Db;
  /** Secret de signature des cookies (`BETTER_AUTH_SECRET`). */
  secret: string;
  /** URL publique de l'application (`APP_URL`). */
  baseURL: string;
  /**
   * Proxys placés **devant** le reverse proxy et qui ajoutent eux aussi leur hop à
   * `X-Forwarded-For` (`TRUSTED_PROXIES`, IP ou CIDR ; par exemple un CDN). Vide le plus souvent.
   */
  trustedProxies?: string[];
};

/**
 * IP du client pour la limite de connexions : le reverse proxy ajoute l'IP de son client à droite
 * de `X-Forwarded-For`, après ce que ce client a pu y écrire. Avec une liste `trustedProxies` non
 * vide, better-auth lit la chaîne de droite à gauche et garde le premier hop non fiable : la valeur
 * ajoutée par le reverse proxy. La boucle locale y figure toujours pour activer cette lecture (sans
 * liste, une chaîne de plusieurs valeurs tomberait dans un compteur partagé par tous les clients).
 * Ce n'est sûr que si l'app n'est joignable que par le reverse proxy (`APP_BIND`, README).
 */
const LOOPBACK_PROXIES = ["127.0.0.1", "::1"];

export function createAuth({ db, secret, baseURL, trustedProxies = [] }: AuthOptions) {
  return betterAuth({
    advanced: {
      ipAddress: { trustedProxies: [...LOOPBACK_PROXIES, ...trustedProxies] },
    },
    secret,
    disabledPaths: ADMIN_HTTP_PATHS,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      password: {
        hash: (password) => hash(password, argon2Options),
        verify: ({ hash: digest, password }) => verify(digest, password),
      },
    },
    user: {
      additionalFields: {
        // Colonne `password_change_suggested` : posée par la réinitialisation de l'admin.
        passwordChangeSuggested: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      // L'échéance est repoussée à 180 jours dès qu'une session sert après plus d'un jour :
      // chaque utilisation prolonge la session sans écrire en base à chaque requête.
      updateAge: DAY_IN_SECONDS,
    },
    hooks: {
      // Inscription libre : réglage de l'admin, lu en base à chaque inscription (ADR-0004).
      // Les comptes créés par l'admin passent par `/admin/create-user`, jamais bloqué.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const { signUpOpen } = await getAppSettings(db);
        if (!signUpOpen) {
          throw APIError.from("FORBIDDEN", { message: "Sign up is closed", code: "SIGN_UP_CLOSED" });
        }
      }),
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      customRules: { "/sign-in/email": { ...SIGN_IN_RATE_LIMIT } },
    },
    plugins: [adminPlugin()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
