import { z } from "zod";

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
