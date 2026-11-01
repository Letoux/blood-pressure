import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { campaignOverview, type CampaignStatus } from "@/domain/campaign";
import { localDateOf } from "@/domain/local-date";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locale";
import { translator } from "@/i18n/translator";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { measurement } from "@/server/db/schema";
import { measurementsCsv, type CsvColumn, type CsvLabels, type ExportedAbsence } from "@/server/export/measurements-csv";
import { userOnly } from "./authed";
import { currentTime } from "./base";

const COLUMNS: CsvColumn[] = [
  "date",
  "time",
  "timeZone",
  "systolic",
  "diastolic",
  "pulse",
  "comment",
  "free",
  "campaign",
  "campaignDay",
  "moment",
  "campaignStatus",
];
const STATUSES: CampaignStatus[] = ["planned", "inProgress", "finished", "incomplete", "missed", "skipped"];

/** Les libellés du CSV, depuis le catalogue partagé (`translator`). */
function csvLabels(locale: Locale): CsvLabels {
  const t = translator(locale);
  return {
    columns: Object.fromEntries(COLUMNS.map((c) => [c, t(`settings.data.csv.columns.${c}`)])) as CsvLabels["columns"],
    moments: { morning: t("measurements.moments.morning"), evening: t("measurements.moments.evening") },
    statuses: Object.fromEntries(STATUSES.map((s) => [s, t(`campaigns.status.${s}`)])) as CsvLabels["statuses"],
    yes: t("settings.data.csv.yes"),
    no: t("settings.data.csv.no"),
  };
}

/**
 * Export CSV de toutes les mesures de l'appelant (ADR-0001), de la plus ancienne à la plus
 * récente, avec ses campagnes manquées ou sautées (une ligne sans valeurs, ADR-0011). L'heure est
 * donnée dans le fuseau des réglages de l'utilisateur, et une campagne est désignée par sa date de
 * début (réelle, sinon prévue) et son statut. `locale` : la langue affichée par l'interface.
 * L'admin n'a pas de mesures et ne peut exporter celles de personne (`userOnly`, ADR-0004).
 */
export const accountExportMeasurements = userOnly
  .input(z.object({ locale: z.enum(LOCALES).default(DEFAULT_LOCALE) }))
  .handler(async ({ context, input }) => {
    const now = currentTime(context);
    const campaignInput = await loadCampaignInput(context.db, context.user.id, now);
    const views = campaignOverview(campaignInput).campaigns;
    const byId = new Map(views.flatMap((view) => (view.id ? [[view.id, view] as const] : [])));
    const absences: ExportedAbsence[] = views.flatMap((view) =>
      view.status === "missed" || view.status === "skipped" ? [{ plannedStart: view.plannedStart, status: view.status }] : [],
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
    const measurements = rows.map(({ campaignId, ...row }) => {
      const view = campaignId === null ? undefined : byId.get(campaignId);
      return {
        ...row,
        campaign: view ? (view.actualStart ?? view.plannedStart) : null,
        campaignStatus: view?.status ?? null,
      };
    });
    const { timeZone } = campaignInput;
    return {
      filename: `tension-${localDateOf(now, timeZone)}.csv`,
      csv: measurementsCsv(measurements, absences, { timeZone, labels: csvLabels(input.locale) }),
    };
  });
