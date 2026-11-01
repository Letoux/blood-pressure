import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

const schema = z.object({
  DATABASE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Variables d'environnement côté serveur, validées au premier accès (pas au build). */
export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}

const pushSchema = z.object({
  // Communiquée aux services push comme contact de l'instance (« subject » VAPID).
  APP_URL: z.url(),
});

let cachedPush: z.infer<typeof pushSchema> | undefined;

/** Variables de l'envoi des notifications push (services `app` et `worker`). */
export function pushEnv(): z.infer<typeof pushSchema> {
  cachedPush ??= pushSchema.parse(process.env);
  return cachedPush;
}

/**
 * Les valeurs d'exemple du `.env.template` commencent toutes par `remplacer-` : un `.env` copié
 * sans les changer donnerait un mot de passe admin et une clé de signature publics (repo public).
 */
const notPlaceholder = (name: string) =>
  z
    .string()
    .refine((value) => !value.startsWith("remplacer-"), {
      message: `${name} vaut encore l'exemple du .env.template : choisissez votre propre valeur.`,
    });

const authSchema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: notPlaceholder("BETTER_AUTH_SECRET").pipe(z.string().min(32)),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: notPlaceholder("ADMIN_PASSWORD").pipe(z.string().min(MIN_PASSWORD_LENGTH)),
  // Liste séparée par des virgules (IP ou CIDR), vide par défaut : voir `.env.template`.
  TRUSTED_PROXIES: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
});

export type AuthEnv = z.infer<typeof authSchema>;

/** Valide les variables de l'authentification ; échoue avec le nom de la variable fautive. */
export function parseAuthEnv(source: Record<string, string | undefined>): AuthEnv {
  const result = authSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`);
    throw new Error(`Configuration invalide (.env) :\n- ${problems.join("\n- ")}`);
  }
  return result.data;
}

let cachedAuth: AuthEnv | undefined;

/** Variables de l'authentification, nécessaires au seul service `app`. */
export function authEnv(): AuthEnv {
  cachedAuth ??= parseAuthEnv(process.env);
  return cachedAuth;
}
