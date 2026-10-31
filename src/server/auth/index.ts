import { getDb } from "@/server/db";
import { authEnv } from "@/server/env";
import { createAuth, type Auth } from "./create-auth";
import { ensureAdmin } from "./ensure-admin";

let auth: Auth | undefined;

/** Instance better-auth du processus, créée au premier appel. */
export function getAuth(): Auth {
  if (!auth) {
    const env = authEnv();
    auth = createAuth({
      db: getDb(),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.APP_URL,
      allowSignUp: env.ALLOW_SIGN_UP,
    });
  }
  return auth;
}

/** Au démarrage de l'app : crée ou met à jour l'admin défini par le `.env`. */
export async function bootstrapAdmin(): Promise<void> {
  const env = authEnv();
  await ensureAdmin(getAuth(), { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
}
