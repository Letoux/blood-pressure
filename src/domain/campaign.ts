// Campagnes (voir `GLOSSARY.md` : Campagne, Créneau, Fréquence, Moyenne de campagne ; ADR-0005,
// ADR-0006). Module pur : à partir des campagnes enregistrées, de leurs mesures, de la fréquence,
// du fuseau et de l'instant présent, il calcule les statuts, les créneaux, la complétude, les
// moyennes et la prochaine campagne. Rien n'est stocké d'autre que la date prévue d'une campagne
// et le créneau de chaque mesure : un statut (y compris « manquée ») est toujours recalculé.

import { addDays, addMonths, daysBetween, localDateOf, localHourOf, type LocalDate } from "./local-date";
import { CAMPAIGN_DAYS, MOMENTS, type CampaignDay, type Moment } from "./slot";

/** Mesures attendues par créneau, et par campagne (6 créneaux). */
export const MEASUREMENTS_PER_SLOT = 3;
export const SLOTS_PER_CAMPAIGN = CAMPAIGN_DAYS.length * MOMENTS.length;
export const EXPECTED_MEASUREMENTS = SLOTS_PER_CAMPAIGN * MEASUREMENTS_PER_SLOT;

export const FREQUENCY_MONTHS = { min: 1, max: 12, default: 3 } as const;

/** Une campagne enregistrée : seule sa date de début prévue est stockée. */
export type StoredCampaign = { id: string; plannedStart: LocalDate };

/** Une mesure telle que le module la lit. Une mesure libre a `campaignId` et `campaignDay` à `null`. */
export type CampaignMeasurement = {
  id: string;
  campaignId: string | null;
  campaignDay: CampaignDay | null;
  moment: Moment;
  takenAt: Date;
  systolic: number;
  diastolic: number;
  pulse: number;
};

export type CampaignInput = {
  campaigns: StoredCampaign[];
  /** Les mesures de l'utilisateur ; les mesures libres sont ignorées. */
  measurements: CampaignMeasurement[];
  frequencyMonths: number;
  /** Fuseau IANA de l'utilisateur : tous les jours sont comptés dans ce fuseau. */
  timeZone: string;
  now: Date;
};

/**
 * - `planned` : aucune mesure, période pas encore passée (y compris le jour prévu) ;
 * - `inProgress` : au moins une mesure, ses 3 jours ne sont pas écoulés ;
 * - `finished` : 3 jours écoulés, 18/18 ;
 * - `incomplete` : 3 jours écoulés, au moins une mesure mais moins de 18 (terminée, signalée) ;
 * - `missed` : la période prévue est passée sans aucune mesure.
 */
export type CampaignStatus = "planned" | "inProgress" | "finished" | "incomplete" | "missed";

export type SlotRef = { day: CampaignDay; moment: Moment };

export type SlotView = SlotRef & {
  /** Le jour du calendrier de ce créneau (selon le début réel, sinon prévu). */
  date: LocalDate;
  /** Nombre de mesures du créneau. Rempli dès la première (`GLOSSARY.md`). */
  count: number;
  filled: boolean;
};

export type Average = { systolic: number; diastolic: number; pulse: number; count: number };

export type CampaignAverages = {
  /** Moyenne de toutes les mesures présentes, sans écarter le premier jour (ADR-0005). */
  global: Average | null;
  morning: Average | null;
  evening: Average | null;
};

export type CampaignView = {
  id: string;
  status: CampaignStatus;
  plannedStart: LocalDate;
  /** Jour de la première mesure, `null` sans mesure. */
  actualStart: LocalDate | null;
  /** Dernier jour (J3) : du début réel, sinon prévu. */
  endDate: LocalDate;
  /** Les 6 créneaux, de J1 matin à J3 soir. */
  slots: SlotView[];
  /** Mesures comptées pour la complétude (au plus 3 par créneau), sur `EXPECTED_MEASUREMENTS`. */
  completeness: number;
  /** Créneaux sans aucune mesure (« J2 soir »). */
  missingSlots: SlotRef[];
  averages: CampaignAverages;
};

export type NextCampaign = {
  plannedStart: LocalDate;
  /** La campagne enregistrée, ou `null` si elle est seulement calculée (pas encore en base). */
  campaignId: string | null;
};

export type CampaignOverview = {
  /** Aujourd'hui dans le fuseau de l'utilisateur. */
  today: LocalDate;
  /** Moment en cours (matin avant midi, soir ensuite), dans le fuseau de l'utilisateur. */
  moment: Moment;
  /** Les campagnes enregistrées, de la plus ancienne à la plus récente. */
  campaigns: CampaignView[];
  /** La campagne en cours, s'il y en a une. */
  current: CampaignView | null;
  /** La prochaine campagne planifiée ; `null` tant qu'aucune campagne n'a été planifiée. */
  next: NextCampaign | null;
  /**
   * Les 2 créneaux d'aujourd'hui, si aujourd'hui tombe dans la campagne en cours ou dans la
   * période de la prochaine (une saisie la commencerait alors en J1).
   */
  todaySlots: { campaignId: string | null; slots: SlotView[] } | null;
};

const momentOf = (now: Date, timeZone: string): Moment => (localHourOf(now, timeZone) < 12 ? "morning" : "evening");

function average(measurements: CampaignMeasurement[]): Average | null {
  if (measurements.length === 0) return null;
  const sum = (key: "systolic" | "diastolic" | "pulse") =>
    measurements.reduce((total, measurement) => total + measurement[key], 0) / measurements.length;
  return { systolic: sum("systolic"), diastolic: sum("diastolic"), pulse: sum("pulse"), count: measurements.length };
}

/** Le début réel : le jour de la première mesure, ramené à J1 selon son jour de campagne. */
function actualStartOf(measurements: CampaignMeasurement[], timeZone: string): LocalDate | null {
  const starts = measurements.map((measurement) =>
    addDays(localDateOf(measurement.takenAt, timeZone), -((measurement.campaignDay ?? 1) - 1)),
  );
  return starts.length === 0 ? null : starts.reduce((min, date) => (date < min ? date : min));
}

function slotsOf(start: LocalDate, measurements: CampaignMeasurement[]): SlotView[] {
  return CAMPAIGN_DAYS.flatMap((day) =>
    MOMENTS.map((moment) => {
      const count = measurements.filter((m) => m.campaignDay === day && m.moment === moment).length;
      return { day, moment, date: addDays(start, day - 1), count, filled: count > 0 };
    }),
  );
}

function viewOf(campaign: StoredCampaign, all: CampaignMeasurement[], timeZone: string, today: LocalDate): CampaignView {
  const measurements = all.filter((measurement) => measurement.campaignId === campaign.id);
  const actualStart = actualStartOf(measurements, timeZone);
  const start = actualStart ?? campaign.plannedStart;
  const endDate = addDays(start, CAMPAIGN_DAYS.length - 1);
  const slots = slotsOf(start, measurements);
  const completeness = slots.reduce((total, slot) => total + Math.min(slot.count, MEASUREMENTS_PER_SLOT), 0);
  const over = today > endDate;
  const status: CampaignStatus =
    actualStart === null
      ? over
        ? "missed"
        : "planned"
      : !over
        ? "inProgress"
        : completeness === EXPECTED_MEASUREMENTS
          ? "finished"
          : "incomplete";
  return {
    id: campaign.id,
    status,
    plannedStart: campaign.plannedStart,
    actualStart,
    endDate,
    slots,
    completeness,
    missingSlots: slots.filter((slot) => !slot.filled).map(({ day, moment }) => ({ day, moment })),
    averages: {
      global: average(measurements),
      morning: average(measurements.filter((m) => m.moment === "morning")),
      evening: average(measurements.filter((m) => m.moment === "evening")),
    },
  };
}

const startOf = (view: CampaignView) => view.actualStart ?? view.plannedStart;

/**
 * La prochaine campagne : la dernière enregistrée si elle est encore planifiée, sinon une date
 * calculée (début réel + fréquence). Une campagne manquée replanifie la suivante à partir du
 * jour où elle l'est devenue (lendemain de sa période) plus la fréquence ; une campagne calculée
 * dont la période passe sans mesure est manquée de la même façon.
 */
function nextOf(views: CampaignView[], frequencyMonths: number, today: LocalDate): NextCampaign | null {
  const last = views.at(-1);
  if (!last) return null;
  if (last.status === "planned") return { plannedStart: last.plannedStart, campaignId: last.id };
  const missedOn = (start: LocalDate) => addDays(start, CAMPAIGN_DAYS.length);
  let candidate = addMonths(last.status === "missed" ? missedOn(last.plannedStart) : startOf(last), frequencyMonths);
  while (today > addDays(candidate, CAMPAIGN_DAYS.length - 1)) {
    candidate = addMonths(missedOn(candidate), frequencyMonths);
  }
  return { plannedStart: candidate, campaignId: null };
}

/** Tout ce que l'interface, les statistiques, le compte rendu et les rappels lisent des campagnes. */
export function campaignOverview(input: CampaignInput): CampaignOverview {
  const today = localDateOf(input.now, input.timeZone);
  const views = input.campaigns
    .map((campaign) => viewOf(campaign, input.measurements, input.timeZone, today))
    .sort((a, b) => (startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0));
  const current = views.find((view) => view.status === "inProgress") ?? null;
  const next = nextOf(views, input.frequencyMonths, today);

  let todaySlots: CampaignOverview["todaySlots"] = null;
  if (current && today >= startOf(current)) {
    todaySlots = { campaignId: current.id, slots: current.slots.filter((slot) => slot.date === today) };
  } else if (!current && next && today >= next.plannedStart) {
    // Une saisie aujourd'hui commencerait la campagne : aujourd'hui serait son J1.
    todaySlots = { campaignId: next.campaignId, slots: slotsOf(today, []).filter((slot) => slot.date === today) };
  }

  return { today, moment: momentOf(input.now, input.timeZone), campaigns: views, current, next, todaySlots };
}

export type Attachment =
  | { kind: "free" }
  /** Rattachée à une campagne enregistrée (en cours, ou planifiée qu'elle commence). */
  | { kind: "campaign"; campaignId: string; day: CampaignDay }
  /** Commence la prochaine campagne calculée : il faut d'abord l'enregistrer à cette date prévue. */
  | { kind: "newCampaign"; plannedStart: LocalDate; day: CampaignDay };

/**
 * Le créneau d'une saisie horodatée `takenAt` (son moment vient du formulaire) :
 * - dans les 3 jours d'une campagne commencée : son jour de campagne ;
 * - pendant la période prévue de la prochaine campagne (sans campagne en cours) : elle la
 *   commence, ce jour devient J1 ;
 * - sinon : mesure libre (ADR-0006). Une saisie antérieure au début réel reste libre.
 */
export function attachMeasurement(input: CampaignInput, takenAt: Date): Attachment {
  const overview = campaignOverview(input);
  const date = localDateOf(takenAt, input.timeZone);
  const dayFrom = (start: LocalDate) => (daysBetween(start, date) + 1) as CampaignDay;
  for (const view of overview.campaigns) {
    if (view.actualStart !== null && date >= view.actualStart && date <= view.endDate) {
      return { kind: "campaign", campaignId: view.id, day: dayFrom(view.actualStart) };
    }
  }
  const next = overview.next;
  if (next && date >= next.plannedStart && date <= addDays(next.plannedStart, CAMPAIGN_DAYS.length - 1)) {
    return next.campaignId === null
      ? { kind: "newCampaign", plannedStart: next.plannedStart, day: 1 }
      : { kind: "campaign", campaignId: next.campaignId, day: 1 };
  }
  return { kind: "free" };
}

export type ScheduleResult =
  | { kind: "create" }
  | { kind: "move"; campaignId: string }
  | { kind: "error"; reason: "past" | "overlap" };

/**
 * Planifier une campagne au `start` choisi : la première, ou avancer ou reporter la prochaine.
 * Jamais avant aujourd'hui, ni avant la fin de la campagne en cours.
 */
export function scheduleCampaign(input: CampaignInput, start: LocalDate): ScheduleResult {
  const overview = campaignOverview(input);
  if (start < overview.today) return { kind: "error", reason: "past" };
  if (overview.current && start <= overview.current.endDate) return { kind: "error", reason: "overlap" };
  const campaignId = overview.next?.campaignId;
  return campaignId ? { kind: "move", campaignId } : { kind: "create" };
}
