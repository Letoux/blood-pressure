import { describe, expect, it } from "vitest";
import { campaignOverview, type CampaignMeasurement } from "./campaign";
import { reportOf } from "./report";
import type { CampaignDay, Moment } from "./slot";

const TZ = "Europe/Paris";

let nextId = 0;

/**
 * `count` mesures (au plus 18) d'une campagne commencée le jour `start`, le matin à `morning`
 * et le soir à `evening` (systolique/diastolique), pouls 70.
 */
function campaign(
  id: string,
  start: string,
  count: number,
  morning: [number, number],
  evening: [number, number] = morning,
): CampaignMeasurement[] {
  const measurements: CampaignMeasurement[] = [];
  for (const day of [1, 2, 3] as CampaignDay[]) {
    for (const moment of ["morning", "evening"] as Moment[]) {
      for (let i = 0; i < 3 && measurements.length < count; i += 1) {
        const takenAt = new Date(`${start}T${moment === "morning" ? "07" : "19"}:0${i}:00Z`);
        takenAt.setUTCDate(takenAt.getUTCDate() + day - 1);
        const [systolic, diastolic] = moment === "morning" ? morning : evening;
        nextId += 1;
        measurements.push({ id: `m${nextId}`, campaignId: id, campaignDay: day, moment, takenAt, systolic, diastolic, pulse: 70 });
      }
    }
  }
  return measurements;
}

const free = (date: string, systolic: number, diastolic: number): CampaignMeasurement => {
  nextId += 1;
  return {
    id: `m${nextId}`,
    campaignId: null,
    campaignDay: null,
    moment: "evening",
    takenAt: new Date(`${date}T12:00:00Z`),
    systolic,
    diastolic,
    pulse: 70,
  };
};

function overviewOf(campaigns: Record<string, string>, measurements: CampaignMeasurement[], now: string) {
  return campaignOverview({
    campaigns: Object.entries(campaigns).map(([id, plannedStart]) => ({ id, plannedStart })),
    measurements,
    frequencyMonths: 3,
    timeZone: TZ,
    now: new Date(now),
  });
}

/** Six ans d'historique : aujourd'hui le 15 juin 2026. */
function history() {
  return overviewOf(
    {
      old: "2020-03-01", // plus de 5 ans
      fiveYearsAgo: "2021-06-15", // pile 5 ans
      before: "2025-06-14", // un an et un jour
      yearAgo: "2025-06-15", // pile un an
      recent: "2026-03-01",
      last: "2026-06-01",
      running: "2026-06-14", // en cours
      missed: "2026-05-01", // manquée
    },
    [
      ...campaign("old", "2020-03-01", 18, [150, 95]),
      ...campaign("fiveYearsAgo", "2021-06-15", 18, [145, 92]),
      ...campaign("before", "2025-06-14", 18, [140, 90]),
      ...campaign("yearAgo", "2025-06-15", 18, [138, 88]),
      ...campaign("recent", "2026-03-01", 12, [130, 80]),
      ...campaign("last", "2026-06-01", 18, [126, 78]),
      ...campaign("running", "2026-06-14", 4, [170, 100]),
    ],
    "2026-06-15T10:00:00Z",
  );
}

const ids = (report: ReturnType<typeof reportOf>) => report.campaigns.map((entry) => entry.campaign.id);

describe("période du compte rendu", () => {
  it("dernière campagne : la plus récente campagne terminée, pas celle en cours", () => {
    expect(ids(reportOf(history(), "lastCampaign"))).toEqual(["last"]);
  });

  it("1 an : les campagnes terminées commencées depuis un an jour pour jour, bornes comprises", () => {
    const report = reportOf(history(), "oneYear");
    expect(ids(report)).toEqual(["yearAgo", "recent", "last"]);
    expect(report.from).toBe("2025-06-15");
    expect(report.to).toBe("2026-06-15");
  });

  it("5 ans : depuis cinq ans jour pour jour", () => {
    expect(ids(reportOf(history(), "fiveYears"))).toEqual(["fiveYearsAgo", "before", "yearAgo", "recent", "last"]);
  });

  it("tout : toutes les campagnes terminées, ni en cours, ni manquée", () => {
    const report = reportOf(history(), "all");
    expect(ids(report)).toEqual(["old", "fiveYearsAgo", "before", "yearAgo", "recent", "last"]);
    expect(report.from).toBe("2020-03-01");
  });

  it("sans campagne terminée : compte rendu vide", () => {
    const report = reportOf(overviewOf({}, [], "2026-06-15T10:00:00Z"), "all");
    expect(report.campaigns).toEqual([]);
    expect(report.from).toBeNull();
    expect(report.summary).toEqual({
      averages: { global: null, morning: null, evening: null },
      campaignCount: 0,
      completeCount: 0,
      completeShare: null,
      missedCount: 0,
      skippedCount: 0,
    });
    expect(reportOf(overviewOf({}, [], "2026-06-15T10:00:00Z"), "lastCampaign").from).toBeNull();
  });

  it("les campagnes manquées et sautées de la période sont listées à part et comptées", () => {
    const report = reportOf(history(), "oneYear");
    expect(report.absent.map((view) => [view.id, view.status])).toEqual([["missed", "missed"]]);
    expect(report.summary).toMatchObject({ campaignCount: 3, missedCount: 1, skippedCount: 0 });
    // Hors période (avant la dernière campagne terminée).
    expect(reportOf(history(), "lastCampaign").absent).toEqual([]);

    const skipped = campaignOverview({
      campaigns: [
        { id: "c1", plannedStart: "2026-01-05", status: "missed" },
        { id: "c2", plannedStart: "2026-01-12", originalStart: "2026-01-05", status: "skipped", skippedOn: "2026-01-13" },
      ],
      measurements: [],
      frequencyMonths: 3,
      timeZone: TZ,
      now: new Date("2026-02-01T10:00:00Z"),
    });
    const all = reportOf(skipped, "all");
    expect(all.absent.map((view) => view.status)).toEqual(["missed", "skipped"]);
    expect(all.summary).toMatchObject({ campaignCount: 0, missedCount: 1, skippedCount: 1 });
    expect(reportOf(skipped, "lastCampaign").absent.map((view) => view.status)).toEqual(["missed", "skipped"]);
  });
});

describe("résumé de la période et écarts", () => {
  // Aujourd'hui le 15 juin 2026. Trois campagnes terminées :
  // - a (janvier) : 18 mesures, matin 140/90, soir 130/80 → globale 135/85 ;
  // - b (mars) : 12 mesures (J1 et J2), matin 130/84, soir 120/76 → globale 125/80, incomplète ;
  // - c (juin) : 18 mesures, 120/78 → globale 120/78.
  // Plus une mesure libre à 190/120, qui ne doit compter nulle part.
  const overview = () =>
    overviewOf(
      { a: "2026-01-10", b: "2026-03-10", c: "2026-06-01" },
      [
        ...campaign("a", "2026-01-10", 18, [140, 90], [130, 80]),
        ...campaign("b", "2026-03-10", 12, [130, 84], [120, 76]),
        ...campaign("c", "2026-06-01", 18, [120, 78]),
        free("2026-04-01", 190, 120),
      ],
      "2026-06-15T10:00:00Z",
    );

  it("moyennes de toutes les mesures des campagnes de la période, nombre de campagnes et part de complètes", () => {
    const { summary } = reportOf(overview(), "all");
    // Globale : (18 × 135 + 12 × 125 + 18 × 120) / 48 = 6090 / 48 = 126,875 ;
    // (18 × 85 + 12 × 80 + 18 × 78) / 48 = 3894 / 48 = 81,125.
    expect(summary.averages.global).toEqual({ systolic: 126.875, diastolic: 81.125, pulse: 70, count: 48 });
    // Matin : (9 × 140 + 6 × 130 + 9 × 120) / 24 = 3120 / 24 = 130 ; (9 × 90 + 6 × 84 + 9 × 78) / 24 = 2016 / 24 = 84.
    expect(summary.averages.morning).toEqual({ systolic: 130, diastolic: 84, pulse: 70, count: 24 });
    // Soir : (9 × 130 + 6 × 120 + 9 × 120) / 24 = 2970 / 24 = 123,75 ; (9 × 80 + 6 × 76 + 9 × 78) / 24 = 1878 / 24 = 78,25.
    expect(summary.averages.evening).toEqual({ systolic: 123.75, diastolic: 78.25, pulse: 70, count: 24 });
    expect(summary.campaignCount).toBe(3);
    expect(summary.completeCount).toBe(2);
    expect(summary.completeShare).toBeCloseTo(2 / 3);
  });

  it("chaque campagne porte son écart avec la précédente, même quand la précédente est hors période", () => {
    const all = reportOf(overview(), "all");
    expect(all.campaigns.map((entry) => [entry.campaign.id, entry.complete, entry.delta])).toEqual([
      ["a", true, null],
      ["b", false, { systolic: -10, diastolic: -5 }],
      ["c", true, { systolic: -5, diastolic: -2 }],
    ]);
    const last = reportOf(overview(), "lastCampaign");
    expect(last.campaigns[0]?.delta).toEqual({ systolic: -5, diastolic: -2 });
    expect(last.summary.averages.global).toEqual({ systolic: 120, diastolic: 78, pulse: 70, count: 18 });
    expect(last.from).toBe("2026-06-01");
  });

  it("la campagne incomplète garde son n/18 et ses créneaux manquants", () => {
    const b = reportOf(overview(), "all").campaigns[1]!.campaign;
    expect(b.completeness).toBe(12);
    expect(b.missingSlots).toEqual([
      { day: 3, moment: "morning" },
      { day: 3, moment: "evening" },
    ]);
  });

  it("le graphique de la période n'a que ses campagnes, et aucune mesure libre", () => {
    const report = reportOf(overview(), "lastCampaign");
    expect(report.points).toEqual([
      { campaignId: "c", date: "2026-06-01", systolic: 120, diastolic: 78, completeness: 18, complete: true },
    ]);
    expect(reportOf(overview(), "all").points.map((point) => point.campaignId)).toEqual(["a", "b", "c"]);
  });
});
