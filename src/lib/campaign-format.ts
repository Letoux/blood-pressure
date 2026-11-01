"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { LocalDate } from "@/domain/local-date";
import type { CampaignDay, Moment } from "@/domain/slot";

/** Une pression (ou un pouls) affichée : arrondie au mmHg près. */
export const mmHg = (value: number) => Math.round(value);

/**
 * Affichage d'un jour local (`2026-02-03`) et d'un créneau (« J2 soir »). Un jour local n'a pas de
 * fuseau : il est formaté à midi UTC, en UTC, pour ne jamais changer de jour.
 */
export function useCampaignFormat() {
  const format = useFormatter();
  const t = useTranslations("campaigns");
  return {
    date: (date: LocalDate, style: "full" | "long" | "medium" = "long") =>
      format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: style, timeZone: "UTC" }),
    slot: (slot: { day: CampaignDay | number; moment: Moment }) => t("slot", { day: slot.day, moment: slot.moment }),
  };
}
