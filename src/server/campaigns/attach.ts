import { and, eq, inArray } from "drizzle-orm";
import { attachMeasurement, type CampaignInput } from "@/domain/campaign";
import type { Queryable } from "@/server/db/client";
import { campaign } from "@/server/db/schema";
import { insertCampaign } from "./missed";

/** Ce qui s'écrit dans les colonnes `campaign_id` et `campaign_day` d'une mesure. */
export type SlotColumns = { campaignId: string | null; campaignDay: number | null };

/**
 * Le créneau d'une saisie horodatée `takenAt`, selon le domaine (`attachMeasurement`). Quand elle
 * commence une campagne calculée, celle-ci est d'abord enregistrée à sa date prévue. Quand elle
 * commence une campagne manquée (saisie a posteriori), son statut enregistré est effacé et ses
 * rattrapages jamais commencés sont supprimés (ADR-0011).
 */
export async function slotColumns(db: Queryable, userId: string, input: CampaignInput, takenAt: Date): Promise<SlotColumns> {
  const attachment = attachMeasurement(input, takenAt);
  if (attachment.kind === "free") return { campaignId: null, campaignDay: null };

  const campaignId =
    attachment.kind === "campaign"
      ? attachment.campaignId
      : await insertCampaign(db, userId, input, {
          plannedStart: attachment.plannedStart,
          originalStart: attachment.originalStart,
        });
  if (attachment.day === 1) {
    // Une campagne qui commence n'est plus manquée (le worker a pu l'enregistrer entre-temps).
    await db
      .update(campaign)
      .set({ status: null, updatedAt: new Date() })
      .where(and(eq(campaign.id, campaignId), eq(campaign.userId, userId), eq(campaign.status, "missed")));
  }
  if (attachment.dropCatchUps.length > 0) {
    await db
      .delete(campaign)
      .where(and(eq(campaign.userId, userId), inArray(campaign.id, attachment.dropCatchUps)));
  }
  return { campaignId, campaignDay: attachment.day };
}
