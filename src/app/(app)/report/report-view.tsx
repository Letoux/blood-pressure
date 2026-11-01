"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Printer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { CampaignAverages } from "@/components/campaign-averages";
import { CampaignChart } from "@/components/campaign-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EXPECTED_MEASUREMENTS, type Average, type CampaignView } from "@/domain/campaign";
import { guidelineOf, positionOf, type Guideline } from "@/domain/guideline";
import { DEFAULT_REPORT_PERIOD, REPORT_PERIODS, type Delta, type Report, type ReportCampaign, type ReportPeriod } from "@/domain/report";
import type { CampaignDay } from "@/domain/slot";
import { mmHg, useCampaignFormat } from "@/lib/campaign-format";
import { orpc } from "@/lib/orpc";

type Measurement = NonNullable<ReturnType<typeof useCampaignMeasurements>>[number];



/** « +4 », « −2 » (vrai signe moins), « 0 ». */
function signed(value: number) {
  const rounded = mmHg(value);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${-rounded}` : "0";
}

/** Les mesures de campagne de l'appelant (les mesures libres sont écartées : `campaignId === null`). */
function useCampaignMeasurements() {
  const list = useQuery(orpc.measurements.list.queryOptions());
  return list.data?.filter((measurement) => measurement.campaignId !== null);
}

/**
 * Compte rendu destiné au médecin (`GLOSSARY.md`) : une période, son résumé et une carte par
 * campagne terminée. Tout vient de `report.get` (`src/domain/report.ts`), rien n'est recalculé
 * ici. La même page s'imprime : navigation et commandes masquées, tableaux dépliés, en-tête avec
 * le nom et la période, bandeaux et mention conservés.
 */
export function ReportView({ userName }: { userName: string }) {
  const t = useTranslations("report");
  const format = useCampaignFormat();
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_REPORT_PERIOD);
  const report = useQuery(orpc.report.get.queryOptions({ input: { period } }));
  const settings = useQuery(orpc.settings.get.queryOptions());
  const measurements = useCampaignMeasurements();

  const data = report.data;
  const guideline = settings.data ? guidelineOf(settings.data.guideline) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-period">{t("period.label")}</Label>
          <NativeSelect
            id="report-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
          >
            {REPORT_PERIODS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {t(`period.${value}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          {t("print")}
        </Button>
      </div>

      <header className="flex flex-col gap-0.5">
        <p className="font-semibold">{`${userName} · ${t(`period.${period}`)}`}</p>
        {data?.from && (
          <p className="text-sm text-muted-foreground">
            {t("range", { from: format.date(data.from, "medium"), to: format.date(data.to, "medium") })}
          </p>
        )}
      </header>

      {data && guideline && (
        <>
          <Summary report={data} guideline={guideline} />
          {data.campaigns.length > 0 && (
            <section aria-labelledby="report-campaigns-title" className="flex flex-col gap-4">
              <h2 id="report-campaigns-title" className="text-lg font-semibold">
                {t("campaigns.title")}
              </h2>
              {[...data.campaigns].reverse().map((entry) => (
                <CampaignCard
                  key={entry.campaign.id}
                  entry={entry}
                  measurements={measurements?.filter((m) => m.campaignId === entry.campaign.id)}
                />
              ))}
            </section>
          )}
          {data.absent.length > 0 && <AbsentCampaigns campaigns={data.absent} />}
        </>
      )}
    </div>
  );
}

/** Les campagnes manquées ou sautées de la période (ADR-0011), en liste compacte. */
function AbsentCampaigns({ campaigns }: { campaigns: CampaignView[] }) {
  const t = useTranslations("report.absent");
  const tc = useTranslations("campaigns");
  const format = useCampaignFormat();
  return (
    <section aria-labelledby="report-absent-title" className="flex flex-col gap-2 print:break-inside-avoid">
      <h2 id="report-absent-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ul className="flex flex-col divide-y rounded-xl border text-sm">
        {[...campaigns].reverse().map((campaign) => (
          <li key={campaign.id ?? campaign.plannedStart} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
            <span>
              {campaign.status === "skipped" && campaign.skippedOn
                ? tc("history.skippedOn", {
                    date: format.date(campaign.plannedStart, "medium"),
                    skippedOn: format.date(campaign.skippedOn, "medium"),
                  })
                : tc("history.plannedOn", { date: format.date(campaign.plannedStart, "medium") })}
              {campaign.catchUp && ` · ${tc("catchUp")}`}
            </span>
            <span className="text-muted-foreground">{tc(`status.${campaign.status}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AverageValue({ label, average }: { label: string; average: Average | null }) {
  const t = useTranslations("report.summary");
  return (
    <div className="flex flex-col rounded-lg border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">
        {average
          ? t("average", { systolic: mmHg(average.systolic), diastolic: mmHg(average.diastolic) })
          : t("noAverage")}
      </dd>
    </div>
  );
}

function Summary({ report, guideline }: { report: Report; guideline: Guideline }) {
  const t = useTranslations("report.summary");
  const ts = useTranslations("stats");
  const { summary } = report;
  const global = summary.averages.global;

  return (
    <Card role="region" aria-labelledby="report-summary-title" className="print:break-inside-avoid">
      <CardHeader>
        <CardTitle id="report-summary-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.campaignCount === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <p className="text-sm">
              {t("count", {
                count: summary.campaignCount,
                complete: summary.completeCount,
                share: Math.round((summary.completeShare ?? 0) * 100),
              })}
            </p>
            {(summary.missedCount > 0 || summary.skippedCount > 0) && (
              <p className="text-sm">{t("absent", { missed: summary.missedCount, skipped: summary.skippedCount })}</p>
            )}
            <dl className="grid grid-cols-3 gap-2">
              <AverageValue label={t("global")} average={global} />
              <AverageValue label={t("morning")} average={summary.averages.morning} />
              <AverageValue label={t("evening")} average={summary.averages.evening} />
            </dl>
            {global && (
              <p className="text-sm">
                {t("position")}{" "}
                {ts(`standing.${positionOf(global, guideline.threshold)}`, {
                  guideline: guideline.acronym,
                  systolic: guideline.threshold.systolic,
                  diastolic: guideline.threshold.diastolic,
                })}
              </p>
            )}
            <CampaignChart points={report.points} threshold={guideline.threshold} thresholdLabel={guideline.acronym} />
          </>
        )}
        <p className="text-sm text-muted-foreground">{ts("disclaimer")}</p>
      </CardContent>
    </Card>
  );
}

function DeltaLine({ delta }: { delta: Delta | null }) {
  const t = useTranslations("report.campaigns");
  return (
    <p className="text-sm tabular-nums">
      {delta
        ? t("delta", { systolic: signed(delta.systolic), diastolic: signed(delta.diastolic) })
        : t("noPrevious")}
    </p>
  );
}

function CampaignCard({ entry, measurements }: { entry: ReportCampaign; measurements: Measurement[] | undefined }) {
  const t = useTranslations("report.campaigns");
  const tc = useTranslations("campaigns");
  const format = useCampaignFormat();
  const { campaign, complete, delta } = entry;
  const start = campaign.actualStart ?? campaign.plannedStart;

  return (
    <Card role="article" aria-labelledby={`campaign-${campaign.id}`} className="print:break-inside-avoid">
      <CardHeader>
        <CardTitle id={`campaign-${campaign.id}`} className="text-base">
          {tc("history.from", { start: format.date(start, "medium"), end: format.date(campaign.endDate, "medium") })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {tc("history.plannedOn", { date: format.date(campaign.plannedStart, "medium") })}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!complete && (
          <p className="flex items-start gap-2 rounded-lg border-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-50 print:border-black print:bg-transparent print:text-black">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t("incomplete", {
                count: campaign.completeness,
                total: EXPECTED_MEASUREMENTS,
                slots: campaign.missingSlots.map(format.slot).join(", "),
              })}
            </span>
          </p>
        )}
        {complete && (
          <p className="text-sm tabular-nums">
            {tc("completeness", { count: campaign.completeness, total: EXPECTED_MEASUREMENTS })}
          </p>
        )}
        <CampaignAverages averages={campaign.averages} />
        <DeltaLine delta={delta} />
        {measurements && measurements.length > 0 && (
          <>
            <details className="print:hidden">
              <summary className="cursor-pointer text-sm font-medium underline-offset-2 hover:underline">
                {t("showMeasurements", { count: measurements.length })}
              </summary>
              <MeasurementTable measurements={measurements} />
            </details>
            {/* À l'impression, le tableau est toujours déplié. */}
            <div className="hidden print:block">
              <MeasurementTable measurements={measurements} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MeasurementTable({ measurements }: { measurements: Measurement[] }) {
  const t = useTranslations("report.campaigns.table");
  const tf = useTranslations("measurements.fields");
  const format = useCampaignFormat();
  const formatter = useFormatter();
  const sorted = [...measurements].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  return (
    // À 360 px, le tableau défile dans son conteneur, jamais la page.
    <div className="mt-2 overflow-x-auto print:overflow-visible">
    <table className="w-full text-sm tabular-nums">
      <caption className="sr-only">{t("caption")}</caption>
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1 pr-2 font-medium">{t("slot")}</th>
          <th scope="col" className="py-1 pr-2 font-medium">{t("time")}</th>
          <th scope="col" className="py-1 pr-2 text-right font-medium">{tf("systolic")}</th>
          <th scope="col" className="py-1 pr-2 text-right font-medium">{tf("diastolic")}</th>
          <th scope="col" className="py-1 text-right font-medium">{tf("pulse")}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((measurement) => (
          <tr key={measurement.id} className="border-b last:border-0">
            <td className="py-1 pr-2 whitespace-nowrap">
              {format.slot({ day: measurement.campaignDay as CampaignDay, moment: measurement.moment })}
            </td>
            <td className="py-1 pr-2">{formatter.dateTime(new Date(measurement.takenAt), { dateStyle: "short", timeStyle: "short" })}</td>
            <td className="py-1 pr-2 text-right">{measurement.systolic}</td>
            <td className="py-1 pr-2 text-right">{measurement.diastolic}</td>
            <td className="py-1 text-right">{measurement.pulse}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
