import type { EntryRow } from "@/domain/measurement";
import { momentAt, type Moment } from "@/domain/slot";

/**
 * État complet du formulaire de créneau : un seul objet sérialisable en JSON, pour qu'un
 * brouillon puisse être conservé hors ligne (ticket PWA) puis restauré tel quel.
 */
export type EntryDraft = {
  /** Valeur d'un `<input type="datetime-local">` (heure locale du navigateur). */
  takenAt: string;
  moment: Moment;
  rows: EntryRow[];
  comment: string;
};

export const ROWS_PER_SLOT = 3;

export const emptyRow = (): EntryRow => ({ systolic: "", diastolic: "", pulse: "" });

/** Formulaire neuf : horodaté maintenant, moment pré-sélectionné selon l'heure. */
export function newEntryDraft(now: Date): EntryDraft {
  return {
    takenAt: toDateTimeLocal(now),
    moment: momentAt(now),
    rows: Array.from({ length: ROWS_PER_SLOT }, emptyRow),
    comment: "",
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `2026-10-31T08:05` dans le fuseau du navigateur. */
export function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Inverse de `toDateTimeLocal` ; `null` si la valeur est vide ou invalide. */
export function fromDateTimeLocal(value: string): Date | null {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date : null;
}
