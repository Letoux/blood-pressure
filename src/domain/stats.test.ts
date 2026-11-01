import { describe, expect, it } from "vitest";
import { campaignOverview, type CampaignMeasurement } from "./campaign";
import { guidelineOf } from "./guideline";
import { campaignSeries, latestStanding } from "./stats";
import type { CampaignDay, Moment } from "./slot";

const TZ = "Europe/Paris";
const paris = (local: string) => new Date(`${local}:00+01:00`);

let nextId = 0;
function measure(
  campaignId: string | null,
  day: CampaignDay | null,
  moment: Moment,
  takenAt: Date,
  systolic: number,
  diastolic: number,
): CampaignMeasurement {
  nextId += 1;
  return { id: `m${nextId}`, campaignId, campaignDay: day, moment, takenAt, systolic, diastolic, pulse: 70 };
}

/** `count` mesures (au plus 18) d'une campagne commencée le jour `start` (janvier 2026), à `systolic`/`diastolic`. */
function campaign(id: string, start: number, count: number, systolic: number, diastolic: number) {
  const measurements: CampaignMeasurement[] = [];
  for (const day of [1, 2, 3] as const) {
    for (const moment of ["morning", "evening"] as const) {
      for (let i = 0; i < 3 && measurements.length < count; i += 1) {
        const date = String(start + day - 1).padStart(2, "0");
        measurements.push(
          measure(id, day, moment, paris(`2026-01-${date}T${moment === "morning" ? "07" : "21"}:00`), systolic, diastolic),
        );
      }
    }
  }
  return measurements;
}

const overviewOf = (measurements: CampaignMeasurement[], campaigns: { id: string; plannedStart: string }[], now: string) =>
  campaignOverview({ campaigns, measurements, frequencyMonths: 1, timeZone: TZ, now: paris(now) });

describe("série du graphique", () => {
  it("un point par campagne terminée, avec ses moyennes systolique et diastolique, de la plus ancienne à la plus récente", () => {
    const overview = overviewOf(
      [...campaign("c2", 10, 18, 140, 90), ...campaign("c1", 2, 18, 126, 78)],
      [
        { id: "c2", plannedStart: "2026-01-10" },
        { id: "c1", plannedStart: "2026-01-02" },
      ],
      "2026-01-20T10:00",
    );
    expect(campaignSeries(overview)).toEqual([
      { campaignId: "c1", date: "2026-01-02", systolic: 126, diastolic: 78, completeness: 18, complete: true },
      { campaignId: "c2", date: "2026-01-10", systolic: 140, diastolic: 90, completeness: 18, complete: true },
    ]);
  });

  it("une campagne incomplète est un point à part entière, signalé avec n/18", () => {
    const overview = overviewOf(campaign("c1", 2, 14, 130, 80), [{ id: "c1", plannedStart: "2026-01-02" }], "2026-01-20T10:00");
    expect(campaignSeries(overview)).toEqual([
      { campaignId: "c1", date: "2026-01-02", systolic: 130, diastolic: 80, completeness: 14, complete: false },
    ]);
  });

  it("ni les campagnes en cours, planifiées ou manquées, ni les mesures libres ne sont sur la courbe", () => {
    const overview = overviewOf(
      [
        ...campaign("done", 2, 18, 130, 80),
        ...campaign("current", 19, 4, 150, 95),
        measure(null, null, "morning", paris("2026-01-15T07:00"), 170, 100),
      ],
      [
        { id: "missed", plannedStart: "2026-01-12" },
        { id: "done", plannedStart: "2026-01-02" },
        { id: "current", plannedStart: "2026-01-19" },
      ],
      "2026-01-20T10:00",
    );
    expect(campaignSeries(overview).map((point) => point.campaignId)).toEqual(["done"]);
  });
});

describe("dernière moyenne par rapport au seuil", () => {
  it("sans campagne terminée : rien à situer", () => {
    expect(latestStanding(overviewOf([], [], "2026-01-20T10:00"), guidelineOf("sfhta").threshold)).toBeNull();
  });

  it("situe la dernière campagne terminée, et suit le seuil du référentiel choisi", () => {
    const overview = overviewOf(
      [...campaign("c1", 2, 18, 140, 90), ...campaign("c2", 10, 12, 132, 82)],
      [
        { id: "c1", plannedStart: "2026-01-02" },
        { id: "c2", plannedStart: "2026-01-10" },
      ],
      "2026-01-20T10:00",
    );
    expect(latestStanding(overview, guidelineOf("sfhta").threshold)).toMatchObject({
      point: { campaignId: "c2", systolic: 132, diastolic: 82, completeness: 12 },
      position: "below",
    });
    expect(latestStanding(overview, guidelineOf("hypertensionCanada2025").threshold)).toMatchObject({
      point: { campaignId: "c2" },
      position: "above",
    });
  });
});
