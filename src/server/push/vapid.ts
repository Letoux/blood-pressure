import webpush from "web-push";
import type { Db } from "@/server/db/client";
import { vapidKeys } from "@/server/db/schema";

/** Paire de clés VAPID, en base64url (format de `web-push`). */
export type VapidKeys = { publicKey: string; privateKey: string };

/**
 * Les clés VAPID de l'instance (ADR-0003) : lues en base, ou générées et enregistrées si c'est le
 * premier démarrage. Deux processus qui démarrent ensemble (app et worker) obtiennent les mêmes
 * clés : seule la première insertion compte. Rien à configurer dans le `.env`.
 */
export async function ensureVapidKeys(
  db: Db,
  generate: () => VapidKeys = () => webpush.generateVAPIDKeys(),
): Promise<VapidKeys> {
  const select = () =>
    db.select({ publicKey: vapidKeys.publicKey, privateKey: vapidKeys.privateKey }).from(vapidKeys).limit(1);
  const [existing] = await select();
  if (existing) return existing;

  await db
    .insert(vapidKeys)
    .values({ id: 1, ...generate() })
    .onConflictDoNothing({ target: vapidKeys.id });
  const [stored] = await select();
  return stored!;
}
