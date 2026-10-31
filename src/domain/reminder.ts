// Rappels (voir `GLOSSARY.md` : Rappel, Relance). Module pur, partagé par le formulaire des
// réglages, le routeur et le worker qui envoie les rappels : préférences et leur validation, puis
// les rappels à envoyer à un instant donné (`dueReminders`).

import type { CampaignOverview } from "./campaign";
import { addDays, instantAt, type LocalDate } from "./local-date";
import type { CampaignDay, Moment } from "./slot";

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

// --- Rappels à envoyer ---

/**
 * - `slot` : rappel d'un créneau, à l'heure du matin ou du soir ;
 * - `followUp` : relance d'un créneau toujours pas rempli ;
 * - `dayBefore` : rappel la veille du début de la prochaine campagne.
 */
export const REMINDER_KINDS = ["slot", "followUp", "dayBefore"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export type DueReminder = {
  kind: ReminderKind;
  /** Le jour concerné : celui du créneau, ou le début de la campagne pour `dayBefore`. */
  date: LocalDate;
  /** Le moment du créneau ; `null` pour `dayBefore`. */
  moment: Moment | null;
  /** Le jour de campagne du créneau ; `null` pour `dayBefore`. */
  day: CampaignDay | null;
  /** Identifie le rappel : un rappel dont la clé est dans `sent` ne repart jamais. */
  key: string;
};

export type ReminderInput = {
  preferences: ReminderPreferences;
  /** Fuseau IANA de l'utilisateur, celui de `overview`. */
  timeZone: string;
  overview: CampaignOverview;
  /** Les clés des rappels déjà envoyés (au moins ceux de la veille et du jour). */
  sent: ReadonlySet<string>;
  now: Date;
};

export const reminderKey = (kind: ReminderKind, date: LocalDate, moment: Moment | null): string =>
  `${kind}:${date}:${moment ?? "-"}`;

/** Un rappel en retard (worker arrêté) part encore pendant ce délai après son heure, jamais après. */
export const REMINDER_GRACE_MINUTES = 30;

const MINUTE_MS = 60 * 1000;

/** Les rappels à envoyer à l'instant `now`. */
export function dueReminders(input: ReminderInput): DueReminder[] {
  const { preferences, timeZone, overview, sent, now } = input;
  const due: DueReminder[] = [];
  const within = (from: Date, until: number) => now.getTime() >= from.getTime() && now.getTime() < until;

  // Les créneaux du jour seulement : une relance qui tomberait après minuit ne part pas (une
  // saisie après minuit irait dans le créneau du lendemain).
  for (const slot of overview.todaySlots?.slots ?? []) {
    if (slot.filled) continue;
    const time = slot.moment === "morning" ? preferences.morningTime : preferences.eveningTime;
    const at = instantAt(slot.date, time, timeZone);
    const grace = at.getTime() + REMINDER_GRACE_MINUTES * MINUTE_MS;
    const followUpAt = preferences.followUpEnabled
      ? new Date(at.getTime() + preferences.followUpDelayMinutes * MINUTE_MS)
      : null;
    const reminder = (kind: ReminderKind): DueReminder => ({
      kind,
      date: slot.date,
      moment: slot.moment,
      day: slot.day,
      key: reminderKey(kind, slot.date, slot.moment),
    });
    // Une seule notification par créneau et par passage : dès l'heure de la relance, le rappel
    // (en retard) ne part plus.
    if (followUpAt && within(followUpAt, followUpAt.getTime() + REMINDER_GRACE_MINUTES * MINUTE_MS)) {
      const followUp = reminder("followUp");
      if (!sent.has(followUp.key)) due.push(followUp);
    } else if (within(at, followUpAt ? Math.min(grace, followUpAt.getTime()) : grace)) {
      const slotReminder = reminder("slot");
      if (!sent.has(slotReminder.key)) due.push(slotReminder);
    }
  }

  // La veille du début prévu de la prochaine campagne (enregistrée ou calculée), à l'heure du
  // soir. Une campagne manquée n'est jamais `next` : le rappel suit la campagne replanifiée.
  const next = overview.next;
  if (preferences.dayBeforeReminder && next && addDays(overview.today, 1) === next.plannedStart) {
    const at = instantAt(overview.today, preferences.eveningTime, timeZone);
    const key = reminderKey("dayBefore", next.plannedStart, null);
    if (!sent.has(key) && within(at, at.getTime() + REMINDER_GRACE_MINUTES * MINUTE_MS)) {
      due.push({ kind: "dayBefore", date: next.plannedStart, moment: null, day: null, key });
    }
  }
  return due;
}
