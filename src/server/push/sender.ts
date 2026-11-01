// Envoi des notifications Web Push, partagé par l'app (notification de test) et le worker
// (rappels, ADR-0003). Les procédures et la tâche du worker reçoivent un `PushSender` injecté :
// les tests lui substituent un faux qui enregistre les messages.

import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import type { PushMessage } from "@/lib/push-message";
import type { Db } from "@/server/db/client";
import { pushSubscription } from "@/server/db/schema";
import { isAllowedPushEndpoint } from "./endpoint";
import { createWebPushTransport, type WebPushTransport } from "./transport";
import { ensureVapidKeys } from "./vapid";

export type { WebPushTransport } from "./transport";

/** Un appareil abonné, tel que stocké dans `push_subscription`. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** `sent` : remis au service push ; `gone` : abonnement expiré ou révoqué, à supprimer. */
export type PushOutcome = "sent" | "gone";

/** Envoie un message à un appareil. Toute autre erreur (réseau, service push) est levée. */
export type PushSender = {
  send: (target: PushTarget, message: PushMessage) => Promise<PushOutcome>;
};

/** Durée de vie d'un message chez le service push s'il ne peut pas encore le remettre. */
const TTL_SECONDS = 60 * 60;

/**
 * Le vrai envoi, signé avec les clés VAPID de la base (créées au besoin, ADR-0003).
 * `subject` : URL de l'instance (`APP_URL`) ou `mailto:`, communiqué aux services push.
 */
export function createWebPushSender({
  db,
  subject,
  transport = createWebPushTransport(),
}: {
  db: Db;
  subject: string;
  transport?: WebPushTransport;
}): PushSender {
  let keys: Promise<webpush.VapidKeys> | undefined;
  return {
    async send(target, message) {
      // Abonnement enregistré avant la vérification de `push.subscribe` : traité comme expiré.
      if (!isAllowedPushEndpoint(target.endpoint)) return "gone";
      keys ??= ensureVapidKeys(db);
      const { publicKey, privateKey } = await keys;
      try {
        await transport(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          // Le transport par défaut ne se connecte qu'aux adresses publiques (SSRF) et coupe
          // l'envoi au bout de `PUSH_SEND_TIMEOUT_MS` : un service push lent bloquerait la tâche
          // du worker et donc tous les rappels suivants (`transport.ts`).
          { vapidDetails: { subject, publicKey, privateKey }, TTL: TTL_SECONDS },
        );
        return "sent";
      } catch (error) {
        if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          return "gone";
        }
        throw error;
      }
    },
  };
}

export type DeliveryReport = { sent: number; removed: number; failed: number };

/**
 * Envoie un message à tous les appareils abonnés d'un utilisateur. Un abonnement expiré est
 * supprimé ; un échec sur un appareil n'empêche pas l'envoi aux autres.
 */
export async function sendToUser(
  db: Db,
  sender: PushSender,
  userId: string,
  message: PushMessage,
): Promise<DeliveryReport> {
  const targets = await db
    .select({ endpoint: pushSubscription.endpoint, p256dh: pushSubscription.p256dh, auth: pushSubscription.auth })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  const report: DeliveryReport = { sent: 0, removed: 0, failed: 0 };
  await Promise.all(
    targets.map(async (target) => {
      try {
        if ((await sender.send(target, message)) === "sent") {
          report.sent += 1;
          return;
        }
        await db
          .delete(pushSubscription)
          .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, target.endpoint)));
        report.removed += 1;
      } catch (error) {
        console.error("[push] échec d'envoi", error);
        report.failed += 1;
      }
    }),
  );
  return report;
}
