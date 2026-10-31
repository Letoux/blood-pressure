// Domaine pur des mesures (voir `GLOSSARY.md` : Mesure, Valeur d'alerte). Sans base ni framework :
// partagé par le formulaire de saisie et par le routeur.

/** Les trois valeurs d'une mesure : pressions en mmHg, pouls en battements par minute. */
export type MeasurementValues = {
  systolic: number;
  diastolic: number;
  pulse: number;
};

/** Bornes acceptées, incluses. */
export const MEASUREMENT_BOUNDS = {
  systolic: { min: 60, max: 260 },
  diastolic: { min: 30, max: 160 },
  pulse: { min: 30, max: 220 },
} as const satisfies Record<keyof MeasurementValues, { min: number; max: number }>;

export type MeasurementError =
  | "systolicOutOfRange"
  | "diastolicOutOfRange"
  | "pulseOutOfRange"
  | "systolicNotAboveDiastolic";

const inBounds = (value: number, { min, max }: { min: number; max: number }) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Valeur d'alerte : systolique ou diastolique au moins égale à ce seuil (ADR-0008). */
export const ALERT_VALUE = { systolic: 180, diastolic: 110 } as const;

/** Une valeur d'alerte affiche un avertissement, sans bloquer l'enregistrement. */
export function isAlertValue(values: Pick<MeasurementValues, "systolic" | "diastolic">): boolean {
  return values.systolic >= ALERT_VALUE.systolic || values.diastolic >= ALERT_VALUE.diastolic;
}

/** Les erreurs d'une mesure, vide si elle est valide. */
export function validateMeasurement(values: MeasurementValues): MeasurementError[] {
  const errors: MeasurementError[] = [];
  if (!inBounds(values.systolic, MEASUREMENT_BOUNDS.systolic)) errors.push("systolicOutOfRange");
  if (!inBounds(values.diastolic, MEASUREMENT_BOUNDS.diastolic)) errors.push("diastolicOutOfRange");
  if (!inBounds(values.pulse, MEASUREMENT_BOUNDS.pulse)) errors.push("pulseOutOfRange");
  const pressuresInBounds = !errors.includes("systolicOutOfRange") && !errors.includes("diastolicOutOfRange");
  if (pressuresInBounds && values.systolic <= values.diastolic) errors.push("systolicNotAboveDiastolic");
  return errors;
}

/** Une ligne du formulaire de créneau, telle que saisie. */
export type EntryRow = Record<keyof MeasurementValues, string>;

export type EntryRowError = MeasurementError | "incomplete";

export type EntryRowsResult =
  | { ok: true; measurements: MeasurementValues[] }
  /** `rowErrors[i]` : erreurs de la ligne `i` ; `empty` : aucune ligne remplie. */
  | { ok: false; empty: boolean; rowErrors: EntryRowError[][] };

const FIELDS = ["systolic", "diastolic", "pulse"] as const;

/** Entier positif écrit en chiffres, sinon `NaN` (rejeté ensuite comme hors bornes). */
const parseValue = (text: string) => (/^\d+$/.test(text) ? Number(text) : Number.NaN);

/**
 * Lit les lignes d'un formulaire de créneau : une ligne vide est ignorée, une ligne
 * partiellement remplie est incomplète, et il faut au moins une ligne remplie.
 */
export function readEntryRows(rows: EntryRow[]): EntryRowsResult {
  const measurements: MeasurementValues[] = [];
  const rowErrors = rows.map((row): EntryRowError[] => {
    const texts = FIELDS.map((field) => row[field].trim());
    if (texts.every((text) => text === "")) return [];
    if (texts.some((text) => text === "")) return ["incomplete"];
    const [systolic, diastolic, pulse] = texts.map(parseValue) as [number, number, number];
    const values = { systolic, diastolic, pulse };
    const errors = validateMeasurement(values);
    if (errors.length === 0) measurements.push(values);
    return errors;
  });
  const empty = rowErrors.every((errors) => errors.length === 0) && measurements.length === 0;
  if (empty || rowErrors.some((errors) => errors.length > 0)) return { ok: false, empty, rowErrors };
  return { ok: true, measurements };
}
