// Export CSV des mesures (ADR-0001) : RFC 4180 (virgules, CRLF, guillemets doublés), UTF-8 avec
// BOM pour qu'Excel reconnaisse l'encodage. Fonction pure : les libellés traduits et le fuseau
// sont fournis par l'appelant (`router/account-export-measurements.ts`).
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
  | "moment";

export type CsvLabels = {
  columns: Record<CsvColumn, string>;
  moments: Record<Moment, string>;
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
};

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

/** Date (`AAAA-MM-JJ`) et heure (`HH:mm`) de l'instant dans le fuseau, lisibles par un tableur. */
function localDateTime(instant: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** Le CSV de ces mesures, dans l'ordre donné, avec l'heure dans le fuseau `timeZone`. */
export function measurementsCsv(
  measurements: ExportedMeasurement[],
  { timeZone, labels }: { timeZone: string; labels: CsvLabels },
): string {
  const header = COLUMNS.map((column) => field(labels.columns[column]));
  const rows = measurements.map((m) => {
    const { date, time } = localDateTime(m.takenAt, timeZone);
    const free = m.campaign === null;
    const cells: Record<CsvColumn, string | number | null> = {
      date,
      time,
      timeZone,
      systolic: m.systolic,
      diastolic: m.diastolic,
      pulse: m.pulse,
      comment: m.comment === null ? null : neutralizeFormula(m.comment),
      free: free ? labels.yes : labels.no,
      campaign: m.campaign,
      campaignDay: m.campaignDay,
      moment: labels.moments[m.moment],
    };
    return COLUMNS.map((column) => field(cells[column]));
  });
  return BOM + [header, ...rows].map((cells) => cells.join(",") + CRLF).join("");
}
