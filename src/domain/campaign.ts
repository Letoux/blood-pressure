// Campagnes (voir `GLOSSARY.md` : Campagne, Créneau, Fréquence, Moyenne de campagne, Début en
// retard, Campagne manquée, Campagne de rattrapage, Campagne sautée ; ADR-0005, ADR-0006,
// ADR-0011). Module pur : à partir des campagnes enregistrées, de leurs mesures, de la fréquence,
// du fuseau et de l'instant présent, il calcule les statuts, les créneaux, la complétude, les
// moyennes, les campagnes manquées et la prochaine campagne.
//
// En base : la date prévue d'une campagne, son statut « manquée » ou « sautée » quand il est
// enregistré, le début prévu initial d'un rattrapage, et le créneau de chaque mesure. Le statut
// « manquée » est enregistré par le worker (`missedCampaignsToRecord`), mais ce module le calcule
// de la même façon sans lui : la vue est identique, que le worker soit passé ou non.

import { addDays, addMonths, daysBetween, localDateOf, type LocalDate } from "./local-date";
import { CAMPAIGN_DAYS, MOMENTS, momentAt, type CampaignDay, type Moment } from "./slot";

/** Mesures attendues par créneau, et par campagne (6 créneaux). */
export const MEASUREMENTS_PER_SLOT = 3;
export const SLOTS_PER_CAMPAIGN = CAMPAIGN_DAYS.length * MOMENTS.length;
export const EXPECTED_MEASUREMENTS = SLOTS_PER_CAMPAIGN * MEASUREMENTS_PER_SLOT;

export const FREQUENCY_MONTHS = { min: 1, max: 12, default: 3 } as const;

/**
 * Début en retard : une première mesure peut commencer une campagne du jour prévu (J+0) à J+6.
 * Passé ce délai sans mesure, la campagne est manquée, et un rattrapage commence le lendemain.
 */
export const LATE_START_DAYS = 7;

/** Statut enregistré d'une campagne sans mesure ; sinon le statut est calculé. */
export const STORED_CAMPAIGN_STATUSES = ["missed", "skipped"] as const;
export type StoredCampaignStatus = (typeof STORED_CAMPAIGN_STATUSES)[number];

/** Une campagne enregistrée. */
export type StoredCampaign = {
  id: string;
  plannedStart: LocalDate;
  /** Campagne de rattrapage : le début prévu de la campagne manquée à l'origine. Absent sinon. */
  originalStart?: LocalDate | null;
  status?: StoredCampaignStatus | null;
  /** Le jour où elle a été sautée. */
  skippedOn?: LocalDate | null;
};

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
 * - `planned` : aucune mesure, sa fenêtre de début (J+0 à J+6) n'est pas passée ;
 * - `inProgress` : au moins une mesure, ses 3 jours ne sont pas écoulés ;
 * - `finished` : terminée et complète (3 jours écoulés, 18/18) ;
 * - `incomplete` : terminée, au moins une mesure mais moins de 18 (signalée) ;
 * - `missed` : sa fenêtre de début est passée sans aucune mesure ;
 * - `skipped` : sautée par l'utilisateur, sans mesure. Elle ne compte pas comme manquée.
 *
 * « Campagne terminée » du glossaire : `finished` ou `incomplete` (`isFinished`).
 */
export const CAMPAIGN_STATUSES = ["planned", "inProgress", "finished", "incomplete", "missed", "skipped"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

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
  /** `null` : une campagne manquée calculée, pas encore enregistrée par le worker. */
  id: string | null;
  status: CampaignStatus;
  plannedStart: LocalDate;
  /** Jour de la première mesure, `null` sans mesure. */
  actualStart: LocalDate | null;
  /** Dernier jour (J3) : du début réel, sinon prévu. */
  endDate: LocalDate;
  /** Campagne de rattrapage, et le début prévu de la campagne manquée à l'origine. */
  catchUp: boolean;
  originalStart: LocalDate | null;
  skippedOn: LocalDate | null;
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
  /** Dernier jour où une première mesure la commence encore (J+6) ; manquée ensuite. */
  startBy: LocalDate;
  catchUp: boolean;
  originalStart: LocalDate | null;
  /** Son début prévu est passé sans mesure. */
  late: boolean;
  /** En retard ou de rattrapage : l'utilisateur peut la sauter. */
  skippable: boolean;
};

export type CampaignOverview = {
  /** Aujourd'hui dans le fuseau de l'utilisateur. */
  today: LocalDate;
  /** Moment en cours (matin avant midi, soir ensuite), dans le fuseau de l'utilisateur. */
  moment: Moment;
  /**
   * Toutes les campagnes, de la plus ancienne à la plus récente, sauf la prochaine quand elle
   * n'est que calculée ; y compris les campagnes manquées calculées (`id: null`).
   */
  campaigns: CampaignView[];
  /** La campagne en cours, s'il y en a une. */
  current: CampaignView | null;
  /** La prochaine campagne planifiée ; `null` tant qu'aucune campagne n'a été planifiée. */
  next: NextCampaign | null;
  /**
   * Les 2 créneaux d'aujourd'hui, si aujourd'hui tombe dans la campagne en cours ou dans la
   * fenêtre de début de la prochaine (une saisie la commencerait alors en J1).
   */
  todaySlots: { campaignId: string | null; slots: SlotView[] } | null;
};

/** Terminée (complète ou non) : elle a une moyenne définitive. */
export const isFinished = (view: CampaignView) => view.status === "finished" || view.status === "incomplete";

/** Une campagne manquée ou sautée fait partie de l'historique (ADR-0011) : elle ne se supprime pas. */
export const isDeletable = (view: CampaignView) => view.status !== "missed" && view.status !== "skipped";

/** 18 mesures sur 18. */
export const isComplete = (view: CampaignView) => view.completeness === EXPECTED_MEASUREMENTS;

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

/** Le dernier jour où une première mesure commence encore une campagne prévue à `plannedStart`. */
const startByOf = (plannedStart: LocalDate) => addDays(plannedStart, LATE_START_DAYS - 1);

/** `id: null` : une campagne manquée seulement calculée (pas en base). */
function viewOf(
  campaign: Omit<StoredCampaign, "id"> & { id: string | null },
  all: CampaignMeasurement[],
  timeZone: string,
  today: LocalDate,
): CampaignView {
  const measurements = campaign.id ? all.filter((measurement) => measurement.campaignId === campaign.id) : [];
  const actualStart = actualStartOf(measurements, timeZone);
  const start = actualStart ?? campaign.plannedStart;
  const endDate = addDays(start, CAMPAIGN_DAYS.length - 1);
  const slots = slotsOf(start, measurements);
  const completeness = slots.reduce((total, slot) => total + Math.min(slot.count, MEASUREMENTS_PER_SLOT), 0);
  // Une mesure l'emporte toujours sur un statut enregistré (saisie a posteriori).
  const status: CampaignStatus =
    actualStart !== null
      ? today <= endDate
        ? "inProgress"
        : completeness === EXPECTED_MEASUREMENTS
          ? "finished"
          : "incomplete"
      : campaign.status === "skipped"
        ? "skipped"
        : campaign.status === "missed" || today > startByOf(campaign.plannedStart)
          ? "missed"
          : "planned";
  const originalStart = campaign.originalStart ?? null;
  return {
    id: campaign.id,
    status,
    plannedStart: campaign.plannedStart,
    actualStart,
    endDate,
    catchUp: originalStart !== null,
    originalStart,
    skippedOn: campaign.skippedOn ?? null,
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

type Planned = { plannedStart: LocalDate; originalStart: LocalDate | null };

/** La campagne qui suit `last` : rattrapage après une manquée, sinon début + fréquence. */
function successorOf(last: CampaignView, frequencyMonths: number): Planned {
  if (last.status === "missed") {
    return { plannedStart: addDays(last.plannedStart, LATE_START_DAYS), originalStart: last.originalStart ?? last.plannedStart };
  }
  if (last.status === "skipped") {
    // Date prévue initiale plus la fréquence, sauf si elle était déjà passée le jour du saut.
    const skippedOn = last.skippedOn ?? last.plannedStart;
    const fromOriginal = addMonths(last.originalStart ?? last.plannedStart, frequencyMonths);
    return { plannedStart: fromOriginal < skippedOn ? addMonths(skippedOn, frequencyMonths) : fromOriginal, originalStart: null };
  }
  return { plannedStart: addMonths(startOf(last), frequencyMonths), originalStart: null };
}

function nextOf(planned: Planned, campaignId: string | null, today: LocalDate): NextCampaign {
  const catchUp = planned.originalStart !== null;
  const late = planned.plannedStart < today;
  return {
    plannedStart: planned.plannedStart,
    campaignId,
    startBy: startByOf(planned.plannedStart),
    catchUp,
    originalStart: planned.originalStart,
    late,
    skippable: late || catchUp,
  };
}

/**
 * Les campagnes manquées calculées après la dernière enregistrée (chaque rattrapage manqué en
 * appelle un autre dès le lendemain de sa fenêtre), puis la prochaine campagne.
 */
function followingOf(
  views: CampaignView[],
  input: CampaignInput,
  today: LocalDate,
): { missed: CampaignView[]; next: NextCampaign | null } {
  const last = views.at(-1);
  if (!last) return { missed: [], next: null };
  if (last.status === "planned") {
    return { missed: [], next: nextOf({ plannedStart: last.plannedStart, originalStart: last.originalStart }, last.id, today) };
  }
  const missed: CampaignView[] = [];
  let candidate = successorOf(last, input.frequencyMonths);
  while (today > startByOf(candidate.plannedStart)) {
    const view = viewOf({ id: null, ...candidate }, [], input.timeZone, today);
    missed.push(view);
    candidate = successorOf(view, input.frequencyMonths);
  }
  return { missed, next: nextOf(candidate, null, today) };
}

/** Tout ce que l'interface, les statistiques, le compte rendu et les rappels lisent des campagnes. */
export function campaignOverview(input: CampaignInput): CampaignOverview {
  const today = localDateOf(input.now, input.timeZone);
  const stored = input.campaigns
    .map((campaign) => viewOf(campaign, input.measurements, input.timeZone, today))
    .sort((a, b) => (startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0));
  const { missed, next } = followingOf(stored, input, today);
  const views = [...stored, ...missed];
  const current = views.find((view) => view.status === "inProgress") ?? null;

  let todaySlots: CampaignOverview["todaySlots"] = null;
  if (current && today >= startOf(current)) {
    todaySlots = { campaignId: current.id, slots: current.slots.filter((slot) => slot.date === today) };
  } else if (!current && next && today >= next.plannedStart && today <= next.startBy) {
    // Une saisie aujourd'hui commencerait la campagne : aujourd'hui serait son J1.
    todaySlots = { campaignId: next.campaignId, slots: slotsOf(today, []).filter((slot) => slot.date === today) };
  }

  return { today, moment: momentAt(input.now, input.timeZone), campaigns: views, current, next, todaySlots };
}

/** Une campagne manquée à enregistrer : `campaignId` pour une campagne en base, sinon à créer. */
export type MissedCampaign = { campaignId: string | null; plannedStart: LocalDate; originalStart: LocalDate | null };

/**
 * Les campagnes manquées dont le statut n'est pas encore enregistré (le worker les enregistre,
 * comme les écritures de campagnes du routeur). Vide une fois fait : l'opération est idempotente.
 */
export function missedCampaignsToRecord(input: CampaignInput): MissedCampaign[] {
  const recorded = new Set(input.campaigns.filter((campaign) => campaign.status === "missed").map((c) => c.id));
  return campaignOverview(input)
    .campaigns.filter((view) => view.status === "missed" && !(view.id && recorded.has(view.id)))
    .map((view) => ({ campaignId: view.id, plannedStart: view.plannedStart, originalStart: view.originalStart }));
}

export type Attachment =
  | { kind: "free" }
  /**
   * Rattachée à une campagne enregistrée (commencée, ou qu'elle commence). `dropCatchUps` : les
   * rattrapages enregistrés, jamais commencés, d'une campagne manquée que la saisie commence.
   * `renumber` : le nouveau jour des mesures de la campagne quand la saisie avance son début réel.
   */
  | {
      kind: "campaign";
      campaignId: string;
      day: CampaignDay;
      dropCatchUps: string[];
      renumber: { id: string; day: CampaignDay }[];
    }
  /** Commence une campagne calculée : il faut d'abord l'enregistrer à cette date prévue. */
  | {
      kind: "newCampaign";
      plannedStart: LocalDate;
      originalStart: LocalDate | null;
      day: CampaignDay;
      dropCatchUps: string[];
    };

/**
 * Le créneau d'une saisie horodatée `takenAt` (son moment vient du formulaire), quelle que soit
 * la date de saisie (saisie a posteriori) :
 * - dans les 3 jours d'une campagne commencée : son jour de campagne ;
 * - avant le début réel d'une campagne commencée, mais dans sa fenêtre de début (J+0 à J+6) et
 *   assez près pour que ses 3 jours couvrent encore toutes ses mesures : ce jour devient J1 et
 *   ses mesures sont renumérotées. Un carnet recopié dans le désordre donne ainsi le même
 *   résultat que dans l'ordre (au-delà, la saisie est libre, comme elle le serait dans l'ordre) ;
 * - dans la fenêtre de début d'une campagne sans mesure, planifiée ou manquée, et postérieure à
 *   la dernière campagne commencée : elle la commence, ce jour devient J1 ;
 * - sinon : mesure libre (ADR-0006). Une campagne sautée ne reçoit jamais de mesure.
 */
export function attachMeasurement(input: CampaignInput, takenAt: Date): Attachment {
  const overview = campaignOverview(input);
  const date = localDateOf(takenAt, input.timeZone);
  const dayFrom = (start: LocalDate) => (daysBetween(start, date) + 1) as CampaignDay;
  const views = overview.campaigns;
  for (const view of views) {
    if (view.id && view.actualStart !== null && date >= view.actualStart && date <= view.endDate) {
      return { kind: "campaign", campaignId: view.id, day: dayFrom(view.actualStart), dropCatchUps: [], renumber: [] };
    }
  }

  // Avant le début réel d'une campagne commencée, dans sa fenêtre de début : le début recule.
  for (const view of views) {
    if (!view.id || view.actualStart === null) continue;
    if (date >= view.actualStart || date < view.plannedStart || date > startByOf(view.plannedStart)) continue;
    const own = input.measurements.filter((measurement) => measurement.campaignId === view.id);
    const lastDay = own
      .map((measurement) => localDateOf(measurement.takenAt, input.timeZone))
      .reduce((last, day) => (day > last ? day : last), view.actualStart);
    if (daysBetween(date, lastDay) >= CAMPAIGN_DAYS.length) continue;
    const shift = daysBetween(date, view.actualStart);
    const renumber = own.map((m) => ({ id: m.id, day: ((m.campaignDay ?? 1) + shift) as CampaignDay }));
    return { kind: "campaign", campaignId: view.id, day: 1, dropCatchUps: [], renumber };
  }

  const lastStarted = views.findLastIndex((view) => view.actualStart !== null);
  const unstarted = (view: CampaignView) => view.status === "planned" || view.status === "missed";
  const candidates: (Planned & { id: string | null; index: number })[] = views.flatMap((view, index) =>
    index > lastStarted && unstarted(view)
      ? [{ id: view.id, plannedStart: view.plannedStart, originalStart: view.originalStart, index }]
      : [],
  );
  const next = overview.next;
  if (next && next.campaignId === null) candidates.push({ id: null, ...next, index: views.length });

  const target = candidates.find((c) => date >= c.plannedStart && date <= startByOf(c.plannedStart));
  if (!target) return { kind: "free" };
  // Une campagne manquée qui commence n'a plus besoin des rattrapages qu'elle avait appelés.
  const origin = target.originalStart ?? target.plannedStart;
  const dropCatchUps = views
    .slice(target.index + 1)
    .flatMap((view) => (view.id && view.originalStart === origin && unstarted(view) ? [view.id] : []));
  return target.id
    ? { kind: "campaign", campaignId: target.id, day: 1, dropCatchUps, renumber: [] }
    : { kind: "newCampaign", plannedStart: target.plannedStart, originalStart: target.originalStart, day: 1, dropCatchUps };
}

export type ScheduleResult =
  | { kind: "create"; originalStart: LocalDate | null }
  | { kind: "move"; campaignId: string }
  | { kind: "error"; reason: "past" | "overlap" };

/**
 * Planifier une campagne au `start` choisi : la première, ou avancer ou reporter la prochaine
 * (un rattrapage reporté reste un rattrapage). Jamais avant aujourd'hui, ni avant la fin de la
 * campagne en cours.
 */
export function scheduleCampaign(input: CampaignInput, start: LocalDate): ScheduleResult {
  const overview = campaignOverview(input);
  if (start < overview.today) return { kind: "error", reason: "past" };
  if (overview.current && start <= overview.current.endDate) return { kind: "error", reason: "overlap" };
  const campaignId = overview.next?.campaignId;
  return campaignId ? { kind: "move", campaignId } : { kind: "create", originalStart: overview.next?.originalStart ?? null };
}

export type SkipResult =
  | { kind: "update"; campaignId: string }
  | { kind: "create"; plannedStart: LocalDate; originalStart: LocalDate | null }
  | { kind: "error"; reason: "notSkippable" };

/**
 * Sauter la prochaine campagne, si elle est en retard ou de rattrapage (en voyage, sans
 * tensiomètre…) : elle est enregistrée « sautée » (le jour même), sans compter comme manquée.
 */
export function skipCampaign(input: CampaignInput): SkipResult {
  const next = campaignOverview(input).next;
  if (!next?.skippable) return { kind: "error", reason: "notSkippable" };
  return next.campaignId
    ? { kind: "update", campaignId: next.campaignId }
    : { kind: "create", plannedStart: next.plannedStart, originalStart: next.originalStart };
}
