"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EXPECTED_MEASUREMENTS } from "@/domain/campaign";
import type { Threshold } from "@/domain/guideline";
import type { CampaignPoint } from "@/domain/stats";
import { mmHg, useCampaignFormat } from "@/lib/campaign-format";

const SERIES = [
  { key: "systolic", color: "var(--chart-systolic)" },
  { key: "diastolic", color: "var(--chart-diastolic)" },
] as const;

type DotProps = { cx?: number; cy?: number; index?: number; payload?: CampaignPoint };

/** Point plein pour une campagne complète, creux pour une campagne incomplète. */
function campaignDot(color: string, radius = 5) {
  function CampaignDot({ cx, cy, index, payload }: DotProps) {
    if (cx === undefined || cy === undefined || !payload) return <g key={index} />;
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={radius}
        stroke={color}
        strokeWidth={2}
        fill={payload.complete ? color : "var(--card)"}
        data-complete={payload.complete}
      />
    );
  }
  return CampaignDot;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: CampaignPoint }[] }) {
  const t = useTranslations("chart");
  const format = useCampaignFormat();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{format.date(point.date, "medium")}</p>
      <p>{t("value", { systolic: mmHg(point.systolic), diastolic: mmHg(point.diastolic) })}</p>
      {!point.complete && (
        <p className="text-muted-foreground">
          {t("incomplete", { count: point.completeness, total: EXPECTED_MEASUREMENTS })}
        </p>
      )}
    </div>
  );
}

/**
 * Graphique des campagnes (statistiques et compte rendu) : un point par campagne terminée
 * (`campaignSeries` de `src/domain/stats.ts`), moyennes systolique et diastolique, point creux
 * pour une campagne incomplète (n/18 dans l'info-bulle), et le seuil du référentiel en deux
 * lignes horizontales pointillées. Couleurs : `--chart-systolic` et `--chart-diastolic`
 * (`globals.css`, clair et sombre). Un tableau masqué reprend les valeurs pour les lecteurs d'écran.
 */
export function CampaignChart({
  points,
  threshold,
  thresholdLabel,
  height = 260,
}: {
  points: CampaignPoint[];
  threshold: Threshold;
  /** Le sigle du référentiel, affiché dans la légende du seuil. */
  thresholdLabel: string;
  height?: number;
}) {
  const t = useTranslations("chart");
  const format = useCampaignFormat();
  const values = points.flatMap((point) => [point.systolic, point.diastolic]);
  const min = Math.floor((Math.min(threshold.diastolic, ...values) - 10) / 10) * 10;
  const max = Math.ceil((Math.max(threshold.systolic, ...values) + 10) / 10) * 10;

  return (
    <figure className="flex flex-col gap-3" aria-label={t("label")}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: series.color }} aria-hidden />
            {t(series.key)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden />
          {t("threshold", {
            guideline: thresholdLabel,
            systolic: threshold.systolic,
            diastolic: threshold.diastolic,
          })}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-muted-foreground" aria-hidden />
          {t("incompleteLegend")}
        </li>
      </ul>
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {/* Pas de calque clavier Recharts : le graphique est masqué aux lecteurs d'écran (le
              tableau ci-dessous le remplace), il ne doit pas recevoir le focus. */}
          <LineChart
            data={points}
            margin={{ top: 8, right: 28, bottom: 0, left: -16 }}
            accessibilityLayer={false}
            tabIndex={-1}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => format.date(date, "medium")}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              stroke="var(--border)"
              interval="preserveStartEnd"
              minTickGap={24}
              padding={{ left: 16, right: 16 }}
            />
            <YAxis
              domain={[min, max]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              stroke="var(--border)"
              allowDecimals={false}
            />
            {SERIES.map((series) => (
              <ReferenceLine
                key={`threshold-${series.key}`}
                y={threshold[series.key]}
                stroke={series.color}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{
                  value: String(threshold[series.key]),
                  position: "right",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            ))}
            {SERIES.map((series) => (
              <Line
                key={series.key}
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={2}
                dot={campaignDot(series.color)}
                activeDot={campaignDot(series.color, 7)}
                isAnimationActive={false}
              />
            ))}
            <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* `sr-only` sur un conteneur : un tableau ne rétrécit pas sous la largeur de son contenu, et
          ferait déborder la page à 360 px. */}
      <div className="sr-only">
        <table>
          <caption>{t("label")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("date")}</th>
              <th scope="col">{t("systolic")}</th>
              <th scope="col">{t("diastolic")}</th>
              <th scope="col">{t("measurements")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.campaignId}>
                <td>{format.date(point.date)}</td>
                <td>{mmHg(point.systolic)}</td>
                <td>{mmHg(point.diastolic)}</td>
                <td>{`${point.completeness}/${EXPECTED_MEASUREMENTS}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
