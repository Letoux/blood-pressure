// Export CSV des mesures (ADR-0001) : RFC 4180 (virgules, CRLF, guillemets doublés), UTF-8 avec
// BOM pour qu'Excel reconnaisse l'encodage. Fonction pure : les libellés traduits et le fuseau
// sont fournis par l'appelant (`router/account-export-measurements.ts`).
import type { CampaignStatus } from "@/domain/campaign";
import { localDateOf, type LocalDate } from "@/domain/local-date";
import type { Moment } from "@/domain/slot";

export type CsvColumn =
  | "date"
  | "time"
  | "timeZone"
  | "systolic"
  | "diastolic"
  | "pulse"
  | "comment"
  | "free"
  | "campaign"
  | "campaignDay"
  | "moment"
  | "campaignStatus";

export type CsvLabels = {
  columns: Record<CsvColumn, string>;
  moments: Record<Moment, string>;
  statuses: Record<CampaignStatus, string>;
  yes: string;
  no: string;
};

export type ExportedMeasurement = {
  takenAt: Date;
  systolic: number;
  diastolic: number;
  pulse: number;
  comment: string | null;
  moment: Moment;
  /** Libellé lisible de la campagne (sa date de début, `AAAA-MM-JJ`) ; `null` pour une mesure libre. */
  campaign: string | null;
  campaignDay: number | null;
  campaignStatus: CampaignStatus | null;
};

/** Une campagne sans mesure, manquée ou sautée (ADR-0011) : une ligne sans valeurs, à sa date prévue. */
export type ExportedAbsence = { plannedStart: LocalDate; status: "missed" | "skipped" };

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

const BOM = "﻿";
const CRLF = "\r\n";

/**
 * Un texte saisi par l'utilisateur qui commence par `=`, `+`, `-`, `@`, tabulation ou retour
 * chariot serait lu comme une formule par un tableur (injection de formule, OWASP) : on le
 * préfixe d'une apostrophe.
 */
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Champ RFC 4180 : entre guillemets s'il contient une virgule, un guillemet ou un saut de ligne. */
function field(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** L'heure (`HH:mm`) de l'instant dans le fuseau, lisible par un tableur. */
function localTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    instant,
  );
}

/**
 * Le CSV de ces mesures, dans l'ordre donné, avec l'heure dans le fuseau `timeZone`. Chaque
 * campagne manquée ou sautée y prend place à sa date prévue, avant les mesures de ce jour-là.
 */
export function measurementsCsv(
  measurements: ExportedMeasurement[],
  absences: ExportedAbsence[],
  { timeZone, labels }: { timeZone: string; labels: CsvLabels },
): string {
  const header = COLUMNS.map((column) => field(labels.columns[column]));
  const absenceRow = (absence: ExportedAbsence) => {
    const cells: Partial<Record<CsvColumn, string>> = {
      date: absence.plannedStart,
      timeZone,
      free: labels.no,
      campaign: absence.plannedStart,
      campaignStatus: labels.statuses[absence.status],
    };
    return COLUMNS.map((column) => field(cells[column] ?? null));
  };
  const pending = [...absences].sort((a, b) => (a.plannedStart < b.plannedStart ? -1 : 1));
  const rows: string[][] = [];
  for (const m of measurements) {
    const date = localDateOf(m.takenAt, timeZone);
    while (pending[0] && pending[0].plannedStart <= date) rows.push(absenceRow(pending.shift()!));
    const cells: Record<CsvColumn, string | number | null> = {
      date,
      time: localTime(m.takenAt, timeZone),
      timeZone,
      systolic: m.systolic,
      diastolic: m.diastolic,
      pulse: m.pulse,
      comment: m.comment === null ? null : neutralizeFormula(m.comment),
      free: m.campaign === null ? labels.yes : labels.no,
      campaign: m.campaign,
      campaignDay: m.campaignDay,
      moment: labels.moments[m.moment],
      campaignStatus: m.campaignStatus === null ? null : labels.statuses[m.campaignStatus],
    };
    rows.push(COLUMNS.map((column) => field(cells[column])));
  }
  rows.push(...pending.map(absenceRow));
  return BOM + [header, ...rows].map((cells) => cells.join(",") + CRLF).join("");
}
