"use client";

import { useTranslations } from "next-intl";
import type { CampaignAverages as Averages } from "@/domain/campaign";
import { mmHg } from "@/lib/campaign-format";

/** « Moyenne 132/84 mmHg (18 mesures) · Matin 135/86 · Soir 129/82 » ; rien sans mesure. */
export function CampaignAverages({ averages }: { averages: Averages }) {
  const t = useTranslations("campaigns.history");
  const { global, morning, evening } = averages;
  if (!global) return null;
  return (
    <p className="text-sm tabular-nums">
      {t("average", { systolic: mmHg(global.systolic), diastolic: mmHg(global.diastolic), count: global.count })}
      {morning && ` · ${t("morning", { systolic: mmHg(morning.systolic), diastolic: mmHg(morning.diastolic) })}`}
      {evening && ` · ${t("evening", { systolic: mmHg(evening.systolic), diastolic: mmHg(evening.diastolic) })}`}
    </p>
  );
}
