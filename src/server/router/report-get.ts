import { z } from "zod";
import { campaignOverview } from "@/domain/campaign";
import { REPORT_PERIODS, reportOf } from "@/domain/report";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { userOnly } from "./authed";
import { currentTime } from "./base";

/**
 * Le compte rendu de l'appelant sur une période (dernière campagne, 1 an, 5 ans, tout) : ses
 * campagnes terminées, leur résumé et leurs écarts (`reportOf`, `src/domain/report.ts`). Les
 * mesures libres n'y sont jamais.
 */
export const reportGet = userOnly
  .input(z.object({ period: z.enum(REPORT_PERIODS) }))
  .handler(async ({ context, input }) =>
    reportOf(campaignOverview(await loadCampaignInput(context.db, context.user.id, currentTime(context))), input.period),
  );
