import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { campaignOverview, scheduleCampaign } from "@/domain/campaign";
import { isLocalDate } from "@/domain/local-date";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { insertCampaign } from "@/server/campaigns/missed";
import { campaign } from "@/server/db/schema";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * Planifie une campagne à la date choisie (jour local `AAAA-MM-JJ`) : la première campagne, ou
 * avancer ou reporter la prochaine (un rattrapage reste un rattrapage). Refuse une date passée (`BAD_REQUEST`) ou antérieure à la fin
 * de la campagne en cours (`CONFLICT`). Renvoie la vue d'ensemble à jour.
 */
export const campaignsSchedule = userOnly
  .input(z.object({ start: z.string().refine(isLocalDate, "Date invalide.") }))
  .handler(({ context, input }) =>
    context.db.transaction(async (tx) => {
      const userId = context.user.id;
      const now = currentTime(context);
      const state = await loadCampaignInput(tx, userId, now);
      const result = scheduleCampaign(state, input.start);
      switch (result.kind) {
        case "error":
          throw new ORPCError(result.reason === "past" ? "BAD_REQUEST" : "CONFLICT", { message: result.reason });
        case "create":
          await insertCampaign(tx, userId, state, { plannedStart: input.start, originalStart: result.originalStart });
          break;
        case "move":
          await tx
            .update(campaign)
            .set({ plannedStart: input.start, updatedAt: new Date() })
            .where(and(eq(campaign.id, result.campaignId), eq(campaign.userId, userId)));
          break;
      }
      return campaignOverview(await loadCampaignInput(tx, userId, now));
    }),
  );
