import { getDb } from "@/server/db";
import { pushEnv } from "@/server/env";
import { createWebPushSender, type PushSender } from "./sender";
import { ensureVapidKeys } from "./vapid";

let sender: PushSender | undefined;

/** Envoi Web Push du processus (app ou worker), créé au premier appel. */
export function getPushSender(): PushSender {
  sender ??= createWebPushSender({ db: getDb(), subject: pushEnv().APP_URL });
  return sender;
}

/** Au démarrage : génère les clés VAPID si c'est le premier (ADR-0003). */
export async function bootstrapVapidKeys(): Promise<void> {
  await ensureVapidKeys(getDb());
}
