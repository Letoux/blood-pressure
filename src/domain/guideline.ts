// Référentiels et seuils (voir `GLOSSARY.md` : Référentiel, Seuil ; ADR-0007, ADR-0008).
// Table constante : l'utilisateur choisit un référentiel dans ses réglages (SFHTA par défaut), son
// seuil d'automesure est tracé sur les graphiques et sert à situer une moyenne, sans diagnostic.
// Le choix ne dépend d'aucun pays (ADR-0007). Les textes sont ici, en français et en anglais,
// parce qu'ils font partie de la table (sigle, nom complet, explication).

import type { Locale } from "@/i18n/locale";

/** Valeurs d'automesure (mmHg) à partir desquelles le référentiel parle d'un niveau élevé. */
export type Threshold = { systolic: number; diastolic: number };

export const GUIDELINE_IDS = [
  "sfhta",
  "esh2023",
  "esc2024",
  "ish2020",
  "nice",
  "jsh",
  "accAha2017",
  "hypertensionCanada2025",
] as const;
export type GuidelineId = (typeof GUIDELINE_IDS)[number];

export type Guideline = {
  id: GuidelineId;
  acronym: string;
  name: Record<Locale, string>;
  explanation: Record<Locale, string>;
  threshold: Threshold;
};

export const DEFAULT_GUIDELINE: GuidelineId = "sfhta";

const HOME_135_85: Threshold = { systolic: 135, diastolic: 85 };
const HOME_130_80: Threshold = { systolic: 130, diastolic: 80 };

/** Les référentiels proposés, dans l'ordre du sélecteur. */
export const GUIDELINES: readonly Guideline[] = [
  {
    id: "sfhta",
    acronym: "SFHTA",
    name: {
      fr: "Société française d’hypertension artérielle",
      en: "French Society of Hypertension (Société française d’hypertension artérielle)",
    },
    explanation: {
      fr: "La société savante française, à l’origine de la règle du 3-3-3. Seuil d’automesure : 135/85, sur la moyenne des 18 mesures.",
      en: "The French learned society behind the 3-3-3 rule. Home threshold: 135/85, on the average of the 18 measurements.",
    },
    threshold: HOME_135_85,
  },
  {
    id: "esh2023",
    acronym: "ESH 2023",
    name: {
      fr: "European Society of Hypertension (Société européenne d’hypertension), recommandations 2023",
      en: "European Society of Hypertension, 2023 guidelines",
    },
    explanation: {
      fr: "Recommandations européennes de 2023, très suivies en Europe. Seuil d’automesure : 135/85.",
      en: "European guidelines from 2023, widely followed in Europe. Home threshold: 135/85.",
    },
    threshold: HOME_135_85,
  },
  {
    id: "esc2024",
    acronym: "ESC 2024",
    name: {
      fr: "European Society of Cardiology (Société européenne de cardiologie), recommandations 2024",
      en: "European Society of Cardiology, 2024 guidelines",
    },
    explanation: {
      fr: "Recommandations européennes de cardiologie de 2024. Seuil d’automesure : 135/85.",
      en: "European cardiology guidelines from 2024. Home threshold: 135/85.",
    },
    threshold: HOME_135_85,
  },
  {
    id: "ish2020",
    acronym: "ISH 2020",
    name: {
      fr: "International Society of Hypertension (Société internationale d’hypertension), recommandations 2020",
      en: "International Society of Hypertension, 2020 guidelines",
    },
    explanation: {
      fr: "Recommandations internationales de 2020, pensées pour être applicables partout dans le monde. Seuil d’automesure : 135/85.",
      en: "International guidelines from 2020, designed to apply worldwide. Home threshold: 135/85.",
    },
    threshold: HOME_135_85,
  },
  {
    id: "nice",
    acronym: "NICE",
    name: {
      fr: "National Institute for Health and Care Excellence (Royaume-Uni), recommandation NG136",
      en: "National Institute for Health and Care Excellence (UK), guideline NG136",
    },
    explanation: {
      fr: "L’institut public britannique qui publie les recommandations de soins. Seuil d’automesure : 135/85.",
      en: "The UK public body that publishes care guidelines. Home threshold: 135/85.",
    },
    threshold: HOME_135_85,
  },
  {
    id: "jsh",
    acronym: "JSH",
    name: {
      fr: "Japanese Society of Hypertension (Société japonaise d’hypertension)",
      en: "Japanese Society of Hypertension",
    },
    explanation: {
      fr: "La société savante japonaise, pionnière de l’automesure. Seuil d’automesure : 135/85.",
      en: "The Japanese learned society, a pioneer of home monitoring. Home threshold: 135/85.",
    },
    threshold: HOME_135_85,
  },
  {
    // À vérifier sur le texte original (Whelton et al., 2017, tableau des équivalences
    // clinique / automesure) : 130/80 vient d'une source secondaire.
    id: "accAha2017",
    acronym: "ACC/AHA 2017",
    name: {
      fr: "American College of Cardiology / American Heart Association, recommandations 2017",
      en: "American College of Cardiology / American Heart Association, 2017 guidelines",
    },
    explanation: {
      fr: "Recommandations américaines de 2017, avec des seuils plus bas que les européennes. Seuil d’automesure : 130/80.",
      en: "US guidelines from 2017, with lower thresholds than the European ones. Home threshold: 130/80.",
    },
    threshold: HOME_130_80,
  },
  {
    id: "hypertensionCanada2025",
    acronym: "Hypertension Canada 2025",
    name: {
      fr: "Hypertension Canada, guide de pratique 2025 pour les soins primaires",
      en: "Hypertension Canada, 2025 primary care guideline",
    },
    explanation: {
      fr: "Recommandations canadiennes de 2025, avec un seuil unique au cabinet comme à domicile. Seuil d’automesure : 130/80.",
      en: "Canadian guidelines from 2025, with a single threshold at the office and at home. Home threshold: 130/80.",
    },
    threshold: HOME_130_80,
  },
];

export function isGuidelineId(value: unknown): value is GuidelineId {
  return GUIDELINE_IDS.includes(value as GuidelineId);
}

export function guidelineOf(id: GuidelineId): Guideline {
  const guideline = GUIDELINES.find((candidate) => candidate.id === id);
  if (!guideline) throw new Error(`référentiel inconnu : ${id}`);
  return guideline;
}

/**
 * Où se situe une moyenne : `above` dès que la systolique ou la diastolique atteint le seuil
 * (« à partir de », `GLOSSARY.md`), `below` sinon. Un fait, jamais un diagnostic (ADR-0008).
 */
export type ThresholdPosition = "below" | "above";

export function positionOf(average: Threshold, threshold: Threshold): ThresholdPosition {
  return average.systolic >= threshold.systolic || average.diastolic >= threshold.diastolic ? "above" : "below";
}
