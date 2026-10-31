import { ensureVapidKeys } from "@/server/push/vapid";
import { userOnly } from "./authed";

/**
 * Clé publique VAPID de l'instance, pour `pushManager.subscribe` dans le navigateur. Comme toutes
 * les procédures `push.*`, réservée à un utilisateur : l'admin n'a pas de rappels (ADR-0004).
 */
export const pushPublicKey = userOnly.handler(async ({ context }) => {
  const { publicKey } = await ensureVapidKeys(context.db);
  return { publicKey };
});
