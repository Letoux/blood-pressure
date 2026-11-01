import { z } from "zod";
import { pushSubscription } from "@/server/db/schema";
import { isAllowedPushEndpoint } from "@/server/push/endpoint";
import { userOnly } from "./authed";

/**
 * Enregistre l'abonnement Web Push de l'appareil (`PushSubscription.toJSON()`). Un appareil
 * déjà abonné, même par un autre compte, est mis à jour et passe à l'appelant.
 */
export const pushSubscribe = userOnly
  .input(
    z.object({
      // Les services push des navigateurs sont tous en HTTPS et publics ; une adresse du réseau
      // local ferait envoyer des requêtes par l'instance à ses voisins (SSRF, `push/endpoint.ts`).
      endpoint: z
        .url({ protocol: /^https$/ })
        .max(2048)
        .refine(isAllowedPushEndpoint, { message: "Adresse de service push non publique." }),
      keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
    }),
  )
  .handler(async ({ context, input }) => {
    const values = { userId: context.user.id, endpoint: input.endpoint, ...input.keys };
    await context.db
      .insert(pushSubscription)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { ...values, updatedAt: new Date() } });
  });
