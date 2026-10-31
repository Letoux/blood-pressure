import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { campaignOverview } from "@/domain/campaign";
import { localDateOf } from "@/domain/local-date";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locale";
import en from "@/i18n/messages/en.json";
import fr from "@/i18n/messages/fr.json";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { measurement } from "@/server/db/schema";
import { measurementsCsv, type CsvLabels } from "@/server/export/measurements-csv";
import { userOnly } from "./authed";
import { currentTime } from "./base";

const catalogs = { fr, en } satisfies Record<Locale, unknown>;

function csvLabels(locale: Locale): CsvLabels {
  const messages = catalogs[locale];
  return { ...messages.settings.data.csv, moments: messages.measurements.moments };
}

/**
 * Export CSV de toutes les mesures de l'appelant (ADR-0001), de la plus ancienne à la plus
 * récente. L'heure est donnée dans le fuseau des réglages de l'utilisateur, et une campagne est
 * désignée par sa date de début (réelle, sinon prévue). L'admin n'a pas de mesures et ne peut
 * exporter celles de personne (`userOnly`, ADR-0004).
 */
export const accountExportMeasurements = userOnly
  .input(z.object({ locale: z.enum(LOCALES).default(DEFAULT_LOCALE) }))
  .handler(async ({ context, input }) => {
    const now = currentTime(context);
    const campaignInput = await loadCampaignInput(context.db, context.user.id, now);
    const campaignStarts = new Map(
      campaignOverview(campaignInput).campaigns.map((view) => [view.id, view.actualStart ?? view.plannedStart]),
    );
    const rows = await context.db
      .select({
        takenAt: measurement.takenAt,
        systolic: measurement.systolic,
        diastolic: measurement.diastolic,
        pulse: measurement.pulse,
        comment: measurement.comment,
        moment: measurement.moment,
        campaignId: measurement.campaignId,
        campaignDay: measurement.campaignDay,
      })
      .from(measurement)
      .where(eq(measurement.userId, context.user.id))
      .orderBy(asc(measurement.takenAt), asc(measurement.createdAt), asc(measurement.id));
    const measurements = rows.map(({ campaignId, ...row }) => ({
      ...row,
      campaign: campaignId === null ? null : (campaignStarts.get(campaignId) ?? null),
    }));
    const { timeZone } = campaignInput;
    return {
      filename: `tension-${localDateOf(now, timeZone)}.csv`,
      csv: measurementsCsv(measurements, { timeZone, labels: csvLabels(input.locale) }),
    };
  });
