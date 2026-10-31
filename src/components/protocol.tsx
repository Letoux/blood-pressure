"use client";

import { useTranslations } from "next-intl";

const RULES = ["rest", "noStimulants", "morning", "evening", "cuff", "series"] as const;

/** Le protocole de mesure (`GLOSSARY.md` : Protocole), au premier lancement et dans les Réglages. */
export function Protocol() {
  const t = useTranslations("protocol");
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>{t("intro")}</p>
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {RULES.map((rule) => (
          <li key={rule}>{t(rule)}</li>
        ))}
      </ul>
    </div>
  );
}
