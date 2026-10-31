import { campaignOverview } from "@/domain/campaign";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * Les campagnes de l'appelant telles que les calcule le domaine (`campaignOverview`) : statuts,
 * créneaux, complétude, moyennes, campagne en cours, créneaux du jour et prochaine campagne.
 */
export const campaignsOverview = userOnly.handler(async ({ context }) =>
  campaignOverview(await loadCampaignInput(context.db, context.user.id, currentTime(context))),
);
