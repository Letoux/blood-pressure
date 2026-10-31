import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locale";
import en from "@/i18n/messages/en.json";
import fr from "@/i18n/messages/fr.json";
import { measurement } from "@/server/db/schema";
import { measurementsCsv, type CsvLabels } from "@/server/export/measurements-csv";
import { userOnly } from "./authed";

const catalogs = { fr, en } satisfies Record<Locale, unknown>;

function csvLabels(locale: Locale): CsvLabels {
  const messages = catalogs[locale];
  return { ...messages.settings.data.csv, moments: messages.measurements.moments };
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Export CSV de toutes les mesures de l'appelant (ADR-0001), de la plus ancienne à la plus
 * récente. L'heure est donnée dans le fuseau du navigateur (`timeZone`, IANA) : il n'y a pas
 * encore de fuseau dans les réglages de l'utilisateur. L'admin n'a pas de mesures et ne peut
 * exporter celles de personne (`userOnly`, ADR-0004).
 */
export const accountExportMeasurements = userOnly
  .input(
    z.object({
      timeZone: z.string().refine(isTimeZone, "Fuseau horaire inconnu.").default("UTC"),
      locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
    }),
  )
  .handler(async ({ context, input }) => {
    const measurements = await context.db
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
    const today = new Date().toISOString().slice(0, 10);
    return {
      filename: `tension-${today}.csv`,
      csv: measurementsCsv(measurements, { timeZone: input.timeZone, labels: csvLabels(input.locale) }),
    };
  });
