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

const authSchema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH),
  ALLOW_SIGN_UP: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AuthEnv = z.infer<typeof authSchema>;

let cachedAuth: AuthEnv | undefined;

/** Variables de l'authentification, nécessaires au seul service `app`. */
export function authEnv(): AuthEnv {
  cachedAuth ??= authSchema.parse(process.env);
  return cachedAuth;
}
