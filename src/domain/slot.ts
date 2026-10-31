// Créneau (voir `GLOSSARY.md`) : un jour de campagne (J1 à J3) et un moment (matin ou soir).
// Une mesure libre a un moment, mais pas de jour de campagne.

export const MOMENTS = ["morning", "evening"] as const;
export type Moment = (typeof MOMENTS)[number];

/** Jours d'une campagne (règle du 3-3-3). */
export const CAMPAIGN_DAYS = [1, 2, 3] as const;
export type CampaignDay = (typeof CAMPAIGN_DAYS)[number];

/** Moment pré-sélectionné à la saisie : le matin avant midi, le soir ensuite (heure locale de `date`). */
export function momentAt(date: Date): Moment {
  return date.getHours() < 12 ? "morning" : "evening";
}
