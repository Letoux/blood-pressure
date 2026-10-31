import { and, eq } from "drizzle-orm";
import { attachMeasurement, type CampaignInput } from "@/domain/campaign";
import type { Queryable } from "@/server/db/client";
import { campaign } from "@/server/db/schema";

/** Ce qui s'écrit dans les colonnes `campaign_id` et `campaign_day` d'une mesure. */
export type SlotColumns = { campaignId: string | null; campaignDay: number | null };

/**
 * Le créneau d'une saisie horodatée `takenAt`, selon le domaine (`attachMeasurement`). Quand elle
 * commence la prochaine campagne calculée, celle-ci est d'abord enregistrée à sa date prévue.
 */
export async function slotColumns(db: Queryable, userId: string, input: CampaignInput, takenAt: Date): Promise<SlotColumns> {
  const attachment = attachMeasurement(input, takenAt);
  switch (attachment.kind) {
    case "free":
      return { campaignId: null, campaignDay: null };
    case "campaign":
      return { campaignId: attachment.campaignId, campaignDay: attachment.day };
    case "newCampaign": {
      // L'index unique (utilisateur, date prévue) évite un doublon si deux saisies se croisent.
      await db.insert(campaign).values({ userId, plannedStart: attachment.plannedStart }).onConflictDoNothing();
      const [created] = await db
        .select({ id: campaign.id })
        .from(campaign)
        .where(and(eq(campaign.userId, userId), eq(campaign.plannedStart, attachment.plannedStart)));
      if (!created) throw new Error("campagne introuvable après sa création");
      return { campaignId: created.id, campaignDay: attachment.day };
    }
  }
}
