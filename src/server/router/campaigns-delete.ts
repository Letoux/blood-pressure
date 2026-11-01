import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { campaignOverview, isDeletable } from "@/domain/campaign";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { campaign } from "@/server/db/schema";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * Supprime une campagne de l'appelant et toutes ses mesures (clé étrangère en cascade).
 * `CONFLICT` pour une campagne manquée ou sautée, même si son statut n'est pas encore
 * enregistré : elle fait partie de l'historique (ADR-0011).
 */
export const campaignsDelete = userOnly
  .input(z.object({ id: z.uuid() }))
  .handler(({ context, input }) =>
    context.db.transaction(async (tx) => {
      const userId = context.user.id;
      const view = campaignOverview(await loadCampaignInput(tx, userId, currentTime(context))).campaigns.find(
        (candidate) => candidate.id === input.id,
      );
      if (view && !isDeletable(view)) throw new ORPCError("CONFLICT", { message: view.status });
      const deleted = await tx
        .delete(campaign)
        .where(and(eq(campaign.id, input.id), eq(campaign.userId, userId)))
        .returning({ id: campaign.id });
      if (deleted.length === 0) throw new ORPCError("NOT_FOUND");
    }),
  );
