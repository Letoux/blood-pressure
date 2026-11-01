import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscription } from "@/server/db/schema";
import { userOnly } from "./authed";

/** Supprime l'abonnement de cet appareil, s'il appartient à l'appelant. */
export const pushUnsubscribe = userOnly
  .input(z.object({ endpoint: z.string().max(2048) }))
  .handler(async ({ context, input }) => {
    await context.db
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.userId, context.user.id), eq(pushSubscription.endpoint, input.endpoint)));
  });
