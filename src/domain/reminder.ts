// Préférences de rappel (voir `GLOSSARY.md` : Rappel, Relance). Module pur, partagé par le
// formulaire des réglages, le routeur et le worker qui envoie les rappels.

/** Heure d'un rappel, `HH:MM` sur 24 heures, dans le fuseau de l'utilisateur. */
export type TimeOfDay = `${number}:${number}`;

/** Une heure `HH:MM` valide (00:00 à 23:59). */
export function isTimeOfDay(value: string): value is TimeOfDay {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Délai de la relance, en minutes après le rappel d'un créneau toujours pas rempli. */
export const FOLLOW_UP_DELAY_MINUTES = { min: 15, max: 240, default: 30 } as const;

/** Délais proposés par le formulaire (tous dans les bornes). */
export const FOLLOW_UP_DELAY_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240] as const;

export type ReminderPreferences = {
  morningTime: TimeOfDay;
  eveningTime: TimeOfDay;
  /** Rappel la veille du début d'une campagne. */
  dayBeforeReminder: boolean;
  /** Relance d'un créneau toujours pas rempli au bout de `followUpDelayMinutes`. */
  followUpEnabled: boolean;
  followUpDelayMinutes: number;
};

export const REMINDER_DEFAULTS: ReminderPreferences = {
  morningTime: "07:30",
  eveningTime: "21:00",
  dayBeforeReminder: true,
  followUpEnabled: false,
  followUpDelayMinutes: FOLLOW_UP_DELAY_MINUTES.default,
};
