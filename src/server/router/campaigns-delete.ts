import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { campaign } from "@/server/db/schema";
import { userOnly } from "./authed";

/** Supprime une campagne de l'appelant et toutes ses mesures (clé étrangère en cascade). */
export const campaignsDelete = userOnly
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ context, input }) => {
    const deleted = await context.db
      .delete(campaign)
      .where(and(eq(campaign.id, input.id), eq(campaign.userId, context.user.id)))
      .returning({ id: campaign.id });
    if (deleted.length === 0) throw new ORPCError("NOT_FOUND");
  });
