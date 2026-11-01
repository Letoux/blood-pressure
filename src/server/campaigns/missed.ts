import { and, eq, inArray, isNull } from "drizzle-orm";
import { missedCampaignsToRecord, type CampaignInput } from "@/domain/campaign";
import type { Queryable } from "@/server/db/client";
import { campaign } from "@/server/db/schema";

/**
 * Enregistre le statut « manquée » que le domaine calcule (`missedCampaignsToRecord`) : met à jour
 * les campagnes en base, crée celles qui ne sont que calculées. Idempotent (déjà enregistrée :
 * rien à faire ; une création concurrente est absorbée par l'index unique utilisateur + date).
 *
 * Appelé par le worker, et avant toute création de campagne par le routeur : une campagne créée
 * après des campagnes manquées seulement calculées les ferait sinon disparaître de l'historique
 * (le domaine ne calcule les manquées qu'après la dernière campagne enregistrée). Renvoie le
 * nombre de campagnes enregistrées.
 */
export async function recordMissedCampaigns(db: Queryable, userId: string, input: CampaignInput): Promise<number> {
  const missed = missedCampaignsToRecord(input);
  if (missed.length === 0) return 0;
  const stored = missed.flatMap((m) => (m.campaignId ? [m.campaignId] : []));
  if (stored.length > 0) {
    await db
      .update(campaign)
      .set({ status: "missed", updatedAt: new Date() })
      .where(and(eq(campaign.userId, userId), inArray(campaign.id, stored), isNull(campaign.status)));
  }
  const computed = missed.filter((m) => m.campaignId === null);
  if (computed.length > 0) {
    await db
      .insert(campaign)
      .values(
        computed.map((m) => ({ userId, plannedStart: m.plannedStart, originalStart: m.originalStart, status: "missed" as const })),
      )
      .onConflictDoNothing();
  }
  return missed.length;
}

/**
 * Crée une campagne (prochaine campagne calculée, rattrapage) à `plannedStart`, après avoir
 * enregistré les campagnes manquées qui la précèdent. Renvoie son identifiant, y compris si une
 * écriture concurrente l'a créée entre-temps.
 */
export async function insertCampaign(
  db: Queryable,
  userId: string,
  input: CampaignInput,
  values: Pick<typeof campaign.$inferInsert, "plannedStart" | "originalStart" | "status" | "skippedOn">,
): Promise<string> {
  await recordMissedCampaigns(db, userId, input);
  await db
    .insert(campaign)
    .values({ userId, ...values })
    .onConflictDoNothing();
  const [created] = await db
    .select({ id: campaign.id })
    .from(campaign)
    .where(and(eq(campaign.userId, userId), eq(campaign.plannedStart, values.plannedStart)));
  if (!created) throw new Error("campagne introuvable après sa création");
  return created.id;
}
