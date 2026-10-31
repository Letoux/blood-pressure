"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { MEASUREMENT_BOUNDS, type EntryRowError } from "@/domain/measurement";

/** Erreur de saisie : celles du domaine, aucune ligne remplie, ou horodatage manquant. */
export type EntryError = EntryRowError | "empty" | "takenAt";

/** Texte traduit d'une erreur de saisie. */
export function useEntryErrorText() {
  const t = useTranslations("measurements.errors");
  return (error: EntryError) => {
    switch (error) {
      case "systolicOutOfRange":
        return t(error, MEASUREMENT_BOUNDS.systolic);
      case "diastolicOutOfRange":
        return t(error, MEASUREMENT_BOUNDS.diastolic);
      case "pulseOutOfRange":
        return t(error, MEASUREMENT_BOUNDS.pulse);
      default:
        return t(error);
    }
  };
}

export function EntryErrors({ errors }: { errors: EntryError[] }) {
  const text = useEntryErrorText();
  if (errors.length === 0) return null;
  return (
    <ul role="alert" className="text-sm text-destructive">
      {errors.map((error) => (
        <li key={error}>{text(error)}</li>
      ))}
    </ul>
  );
}

/** Avertissement non bloquant d'une valeur d'alerte (ADR-0008). */
export function AlertValueWarning() {
  const t = useTranslations("measurements");
  return (
    <p
      role="status"
      className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{t("alert")}</span>
    </p>
  );
}
