// Statistiques : ce que le graphique et la pastille lisent de `campaignOverview` (moyennes et
// complétude déjà calculées par `campaign.ts`, jamais recalculées ici). Module pur.

import { isComplete, isFinished, type CampaignOverview } from "./campaign";
import { positionOf, type Threshold, type ThresholdPosition } from "./guideline";
import type { LocalDate } from "./local-date";

/** Un point du graphique : la moyenne globale d'une campagne terminée (complète ou incomplète). */
export type CampaignPoint = {
  campaignId: string;
  /** Début réel de la campagne. */
  date: LocalDate;
  systolic: number;
  diastolic: number;
  /** Mesures comptées, sur `EXPECTED_MEASUREMENTS` (n/18). */
  completeness: number;
  /** `false` pour une campagne incomplète : point creux et n/18 dans l'info-bulle. */
  complete: boolean;
};

/**
 * Un point par campagne terminée (`finished` ou `incomplete`), de la plus ancienne à la plus
 * récente. Une campagne en cours n'y est pas encore (sa moyenne n'est pas définitive), une
 * campagne planifiée, manquée ou sautée n'a pas de moyenne, et les mesures libres n'en font jamais partie.
 */
export function campaignSeries(overview: Pick<CampaignOverview, "campaigns">): CampaignPoint[] {
  return overview.campaigns.flatMap((campaign) => {
    const average = campaign.averages.global;
    // Une campagne terminée a des mesures, donc un identifiant (enregistrée).
    if (!isFinished(campaign) || !average || !campaign.actualStart || !campaign.id) return [];
    return [
      {
        campaignId: campaign.id,
        date: campaign.actualStart,
        systolic: average.systolic,
        diastolic: average.diastolic,
        completeness: campaign.completeness,
        complete: isComplete(campaign),
      },
    ];
  });
}

/** La dernière campagne terminée et sa position par rapport au seuil ; `null` s'il n'y en a pas. */
export function latestStanding(
  overview: Pick<CampaignOverview, "campaigns">,
  threshold: Threshold,
): { point: CampaignPoint; position: ThresholdPosition } | null {
  const point = campaignSeries(overview).at(-1);
  return point ? { point, position: positionOf(point, threshold) } : null;
}
