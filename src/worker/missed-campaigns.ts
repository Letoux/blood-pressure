// Tâche du worker qui enregistre le statut « manquée » (ADR-0011), lancée régulièrement par
// pg-boss (`main.ts`). Le domaine calcule déjà ce statut sans elle (même vue pour l'utilisateur) :
// elle le rend durable en base, de façon idempotente.

import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { recordMissedCampaigns } from "@/server/campaigns/missed";
import type { Db } from "@/server/db/client";
import { campaign } from "@/server/db/schema";

/** Un passage : pour chaque utilisateur qui a des campagnes. Renvoie le nombre de campagnes enregistrées. */
export async function runMissedCampaigns({ db, now }: { db: Db; now: Date }): Promise<number> {
  const users = await db.selectDistinct({ userId: campaign.userId }).from(campaign);
  let recorded = 0;
  for (const { userId } of users) {
    try {
      recorded += await db.transaction(async (tx) =>
        recordMissedCampaigns(tx, userId, await loadCampaignInput(tx, userId, now)),
      );
    } catch (error) {
      // Un utilisateur en erreur n'empêche pas les autres.
      console.error(`[worker] campagnes manquées de ${userId} en échec`, error);
    }
  }
  return recorded;
}
