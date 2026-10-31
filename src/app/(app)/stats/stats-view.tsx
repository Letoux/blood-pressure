"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CampaignChart } from "@/components/campaign-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPECTED_MEASUREMENTS } from "@/domain/campaign";
import { guidelineOf, type Guideline } from "@/domain/guideline";
import { campaignSeries, latestStanding } from "@/domain/stats";
import { isLocale } from "@/i18n/locale";
import { useCampaignFormat } from "@/lib/campaign-format";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * Statistiques : le graphique des campagnes avec le seuil du référentiel choisi, la position de
 * la dernière moyenne (un fait, jamais un diagnostic : ADR-0008), puis les mesures libres à part.
 */
export function StatsView() {
  const t = useTranslations("stats");
  const overview = useQuery(orpc.campaigns.overview.queryOptions());
  const settings = useQuery(orpc.settings.get.queryOptions());
  if (!overview.data || !settings.data) return null;

  const guideline = guidelineOf(settings.data.guideline);
  const points = campaignSeries(overview.data);
  const standing = latestStanding(overview.data, guideline.threshold);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("campaigns")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <CampaignChart points={points} threshold={guideline.threshold} thresholdLabel={guideline.acronym} />
          )}
          {standing && <Standing standing={standing} guideline={guideline} />}
          <p className="text-sm text-muted-foreground">{t("disclaimer")}</p>
          <GuidelineNote guideline={guideline} />
        </CardContent>
      </Card>
      <FreeMeasurements />
    </div>
  );
}

function Standing({
  standing,
  guideline,
}: {
  standing: NonNullable<ReturnType<typeof latestStanding>>;
  guideline: Guideline;
}) {
  const t = useTranslations("stats.standing");
  const format = useCampaignFormat();
  const { point, position } = standing;
  const Icon = position === "above" ? ArrowUp : ArrowDown;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {t("latest", {
          date: format.date(point.date),
          systolic: Math.round(point.systolic),
          diastolic: Math.round(point.diastolic),
        })}
        {!point.complete && ` (${t("incomplete", { count: point.completeness, total: EXPECTED_MEASUREMENTS })})`}
      </p>
      <p
        role="status"
        className={cn(
          "inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-sm font-medium",
          position === "above"
            ? "border-amber-600/40 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950 dark:text-amber-100"
            : "border-border bg-muted text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {t(position, {
          guideline: guideline.acronym,
          systolic: guideline.threshold.systolic,
          diastolic: guideline.threshold.diastolic,
        })}
      </p>
    </div>
  );
}

function GuidelineNote({ guideline }: { guideline: Guideline }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  return (
    <p className="text-xs text-muted-foreground">
      {t("guideline", { acronym: guideline.acronym, name: guideline.name[isLocale(locale) ? locale : "fr"] })}{" "}
      <Link href="/settings" className="underline underline-offset-2">
        {t("changeGuideline")}
      </Link>
    </p>
  );
}

/** Les mesures libres : jamais sur la courbe ni dans les moyennes (`GLOSSARY.md`). */
function FreeMeasurements() {
  const t = useTranslations("stats.free");
  const tm = useTranslations("measurements");
  const format = useFormatter();
  const measurements = useQuery(orpc.measurements.list.queryOptions());
  const free = measurements.data?.filter((measurement) => measurement.campaignId === null);

  return (
    <section aria-labelledby="free-measurements-title" className="flex flex-col gap-3">
      <h2 id="free-measurements-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {free?.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      {free && free.length > 0 && (
        <ul className="flex flex-col divide-y rounded-xl border">
          {free.map((measurement) => (
            <li key={measurement.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-3">
              <span className="font-semibold tabular-nums">
                {tm("list.pressure", { systolic: measurement.systolic, diastolic: measurement.diastolic })}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {tm("list.pulse", { pulse: measurement.pulse })}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                {format.dateTime(measurement.takenAt, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
