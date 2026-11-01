// Compte rendu (voir `GLOSSARY.md` : Compte rendu, Campagne incomplète ; ADR-0005, ADR-0006).
// Module pur : il lit `campaignOverview` sans rien recalculer des campagnes (moyennes,
// complétude, créneaux manquants), choisit les campagnes d'une période et les résume.
// Les mesures libres n'en font jamais partie : `campaignOverview` les ignore déjà.

import { isComplete, isFinished, type Average, type CampaignAverages, type CampaignOverview, type CampaignView } from "./campaign";
import { addMonths, type LocalDate } from "./local-date";
import { campaignSeries, type CampaignPoint } from "./stats";

export const REPORT_PERIODS = ["lastCampaign", "oneYear", "fiveYears", "all"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export const DEFAULT_REPORT_PERIOD: ReportPeriod = "oneYear";

/** Écart de moyenne globale (mmHg) avec la campagne terminée précédente. */
export type Delta = { systolic: number; diastolic: number };

export type ReportCampaign = {
  campaign: CampaignView;
  /** 18/18 ; sinon la campagne est signalée (n/18 et créneaux manquants). */
  complete: boolean;
  /** Écart avec la campagne terminée précédente, même hors période ; `null` pour la première. */
  delta: Delta | null;
};

export type PeriodSummary = {
  /** Moyennes de toutes les mesures des campagnes de la période (globale, matin, soir). */
  averages: CampaignAverages;
  campaignCount: number;
  completeCount: number;
  /** Part des campagnes complètes (0 à 1) ; `null` sans campagne. */
  completeShare: number | null;
  /** Campagnes manquées et sautées de la période (`Report.absent`). */
  missedCount: number;
  skippedCount: number;
};

export type Report = {
  period: ReportPeriod;
  /** Début de la période : la date limite (1 an, 5 ans), sinon le début de la première campagne retenue. */
  from: LocalDate | null;
  /** Aujourd'hui, dans le fuseau de l'utilisateur. */
  to: LocalDate;
  /** Les campagnes terminées de la période, de la plus ancienne à la plus récente. */
  campaigns: ReportCampaign[];
  /**
   * Les campagnes manquées ou sautées de la période (selon leur début prévu), de la plus ancienne
   * à la plus récente ; pour « dernière campagne », celles qui suivent la dernière terminée.
   */
  absent: CampaignView[];
  summary: PeriodSummary;
  /** Les points du graphique de la période (`campaignSeries`). */
  points: CampaignPoint[];
};

/** Le jour à partir duquel une période commence ; `null` : sans limite de date. */
function limitOf(period: ReportPeriod, today: LocalDate): LocalDate | null {
  if (period === "oneYear") return addMonths(today, -12);
  if (period === "fiveYears") return addMonths(today, -60);
  return null;
}

/**
 * Combine des moyennes déjà calculées par campagne en pondérant par leur nombre de mesures :
 * le résultat est la moyenne de toutes les mesures présentes (ADR-0005), sans relire les mesures.
 */
function combine(averages: (Average | null)[]): Average | null {
  const present = averages.filter((average): average is Average => average !== null);
  const count = present.reduce((total, average) => total + average.count, 0);
  if (count === 0) return null;
  const weighted = (key: "systolic" | "diastolic" | "pulse") =>
    present.reduce((total, average) => total + average[key] * average.count, 0) / count;
  return { systolic: weighted("systolic"), diastolic: weighted("diastolic"), pulse: weighted("pulse"), count };
}

function deltaOf(view: CampaignView, previous: CampaignView | undefined): Delta | null {
  const current = view.averages.global;
  const before = previous?.averages.global;
  if (!current || !before) return null;
  return { systolic: current.systolic - before.systolic, diastolic: current.diastolic - before.diastolic };
}

/** Le compte rendu d'une période : ses campagnes terminées, leur résumé et leurs écarts. */
export function reportOf(overview: Pick<CampaignOverview, "today" | "campaigns">, period: ReportPeriod): Report {
  const over = overview.campaigns.filter(isFinished);
  const limit = limitOf(period, overview.today);
  const selected =
    period === "lastCampaign"
      ? over.slice(-1)
      : over.filter((view) => limit === null || (view.actualStart ?? view.plannedStart) >= limit);
  const campaigns = selected.map((view) => ({
    campaign: view,
    complete: isComplete(view),
    delta: deltaOf(view, over[over.indexOf(view) - 1]),
  }));
  const completeCount = campaigns.filter((entry) => entry.complete).length;
  const ids = new Set(selected.map((view) => view.id));
  const lastStart = over.at(-1)?.actualStart ?? null;
  const absent = overview.campaigns.filter(
    (view) =>
      (view.status === "missed" || view.status === "skipped") &&
      (period === "lastCampaign" ? lastStart === null || view.plannedStart > lastStart : limit === null || view.plannedStart >= limit),
  );

  return {
    period,
    from: limit ?? selected[0]?.actualStart ?? null,
    to: overview.today,
    campaigns,
    absent,
    summary: {
      averages: {
        global: combine(selected.map((view) => view.averages.global)),
        morning: combine(selected.map((view) => view.averages.morning)),
        evening: combine(selected.map((view) => view.averages.evening)),
      },
      campaignCount: campaigns.length,
      completeCount,
      completeShare: campaigns.length === 0 ? null : completeCount / campaigns.length,
      missedCount: absent.filter((view) => view.status === "missed").length,
      skippedCount: absent.filter((view) => view.status === "skipped").length,
    },
    points: campaignSeries(overview).filter((point) => ids.has(point.campaignId)),
  };
}
