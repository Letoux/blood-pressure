import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { campaignOverview, skipCampaign } from "@/domain/campaign";
import { localDateOf } from "@/domain/local-date";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { insertCampaign } from "@/server/campaigns/missed";
import { campaign } from "@/server/db/schema";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * « Sauter la campagne » (ADR-0011) : la prochaine campagne, en retard ou de rattrapage, est
 * enregistrée « sautée » aujourd'hui ; la suivante part de sa date prévue initiale plus la
 * fréquence. `CONFLICT` si elle ne peut pas être sautée. Renvoie la vue d'ensemble à jour.
 */
export const campaignsSkip = userOnly.handler(({ context }) =>
  context.db.transaction(async (tx) => {
    const userId = context.user.id;
    const now = currentTime(context);
    const state = await loadCampaignInput(tx, userId, now);
    const result = skipCampaign(state);
    const skipped = { status: "skipped" as const, skippedOn: localDateOf(now, state.timeZone) };
    switch (result.kind) {
      case "error":
        throw new ORPCError("CONFLICT", { message: result.reason });
      case "update":
        await tx
          .update(campaign)
          .set({ ...skipped, updatedAt: new Date() })
          .where(and(eq(campaign.id, result.campaignId), eq(campaign.userId, userId)));
        break;
      case "create":
        await insertCampaign(tx, userId, state, {
          plannedStart: result.plannedStart,
          originalStart: result.originalStart,
          ...skipped,
        });
        break;
    }
    return campaignOverview(await loadCampaignInput(tx, userId, now));
  }),
);
