import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { FREQUENCY_MONTHS, type CampaignInput, type CampaignMeasurement } from "@/domain/campaign";
import { DEFAULT_TIME_ZONE } from "@/domain/local-date";
import type { CampaignDay } from "@/domain/slot";
import type { Queryable } from "@/server/db/client";
import { campaign, measurement, userSettings } from "@/server/db/schema";

/** Le fuseau et la fréquence d'un utilisateur, valeurs par défaut sans réglage enregistré. */
export async function campaignSettings(db: Queryable, userId: string) {
  const [row] = await db
    .select({ timeZone: userSettings.timeZone, frequencyMonths: userSettings.frequencyMonths })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return {
    timeZone: row?.timeZone ?? DEFAULT_TIME_ZONE,
    frequencyMonths: row?.frequencyMonths ?? FREQUENCY_MONTHS.default,
  };
}

/**
 * L'entrée du domaine des campagnes (`src/domain/campaign.ts`) pour un utilisateur : ses
 * campagnes, leurs mesures (les mesures libres n'y servent pas), sa fréquence et son fuseau.
 * `excludeMeasurementId` : lire l'état sans cette mesure (pour la rattacher à nouveau).
 */
export async function loadCampaignInput(
  db: Queryable,
  userId: string,
  now: Date,
  options: { excludeMeasurementId?: string } = {},
): Promise<CampaignInput> {
  // Requêtes successives : `db` peut être une transaction (une seule connexion).
  const settings = await campaignSettings(db, userId);
  const campaigns = await db
    .select({
      id: campaign.id,
      plannedStart: campaign.plannedStart,
      originalStart: campaign.originalStart,
      status: campaign.status,
      skippedOn: campaign.skippedOn,
    })
    .from(campaign)
    .where(eq(campaign.userId, userId))
    .orderBy(asc(campaign.plannedStart));
  const rows = await db
    .select({
      id: measurement.id,
      campaignId: measurement.campaignId,
      campaignDay: measurement.campaignDay,
      moment: measurement.moment,
      takenAt: measurement.takenAt,
      systolic: measurement.systolic,
      diastolic: measurement.diastolic,
      pulse: measurement.pulse,
    })
    .from(measurement)
    .where(
      and(
        eq(measurement.userId, userId),
        isNotNull(measurement.campaignId),
        options.excludeMeasurementId ? ne(measurement.id, options.excludeMeasurementId) : undefined,
      ),
    );
  const measurements: CampaignMeasurement[] = rows.map((row) => ({
    ...row,
    campaignDay: row.campaignDay as CampaignDay | null,
  }));
  return { ...settings, campaigns, measurements, now };
}
