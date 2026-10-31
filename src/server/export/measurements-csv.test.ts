import { describe, expect, it } from "vitest";
import { measurementsCsv, type CsvLabels } from "./measurements-csv";

const labels: CsvLabels = {
  columns: {
    date: "Date",
    time: "Heure",
    timeZone: "Fuseau horaire",
    systolic: "Systolique (mmHg)",
    diastolic: "Diastolique (mmHg)",
    pulse: "Pouls (bpm)",
    comment: "Commentaire",
    free: "Mesure libre",
    campaign: "Campagne",
    campaignDay: "Jour de campagne",
    moment: "Moment",
  },
  moments: { morning: "Matin", evening: "Soir" },
  yes: "oui",
  no: "non",
};

const HEADER =
  "Date,Heure,Fuseau horaire,Systolique (mmHg),Diastolique (mmHg),Pouls (bpm),Commentaire,Mesure libre,Campagne,Jour de campagne,Moment";

const row = {
  takenAt: new Date("2026-10-30T06:30:00Z"),
  systolic: 132,
  diastolic: 84,
  pulse: 72,
  comment: null,
  moment: "morning" as const,
  campaign: null,
  campaignDay: null,
};

/** Lignes du CSV, sans le BOM. */
function lines(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n");
}

describe("export CSV des mesures", () => {
  it("commence par un BOM UTF-8, sépare les lignes par CRLF et donne l'heure dans le fuseau demandé", () => {
    const csv = measurementsCsv([row], { timeZone: "Europe/Paris", labels });

    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines(csv)).toEqual([HEADER, "2026-10-30,07:30,Europe/Paris,132,84,72,,oui,,,Matin", ""]);
  });

  it("suit le changement d'heure et le changement de jour du fuseau", () => {
    const summer = { ...row, takenAt: new Date("2026-07-01T06:30:00Z") };
    const tokyo = { ...row, takenAt: new Date("2026-10-30T20:15:00Z"), moment: "evening" as const };

    expect(lines(measurementsCsv([summer], { timeZone: "Europe/Paris", labels }))[1]).toMatch(/^2026-07-01,08:30,/);
    expect(lines(measurementsCsv([tokyo], { timeZone: "Asia/Tokyo", labels }))[1]).toMatch(
      /^2026-10-31,05:15,Asia\/Tokyo,.*,Soir$/,
    );
  });

  it("donne minuit en 00:00", () => {
    const midnight = { ...row, takenAt: new Date("2026-10-30T23:00:00Z") };

    expect(lines(measurementsCsv([midnight], { timeZone: "Europe/Paris", labels }))[1]).toMatch(/^2026-10-31,00:00,/);
  });

  it("indique la campagne (sa date de début) et son jour pour une mesure de campagne", () => {
    const inCampaign = { ...row, campaign: "2026-10-29", campaignDay: 2 };

    expect(lines(measurementsCsv([inCampaign], { timeZone: "UTC", labels }))[1]).toBe(
      "2026-10-30,06:30,UTC,132,84,72,,non,2026-10-29,2,Matin",
    );
  });

  it("met entre guillemets les commentaires avec virgule, guillemet ou retour à la ligne (RFC 4180)", () => {
    const comment = { ...row, comment: 'Stress, "café"\nmal dormi' };

    expect(measurementsCsv([comment], { timeZone: "UTC", labels })).toContain(',"Stress, ""café""\nmal dormi",');
  });

  it("neutralise un commentaire qui serait lu comme une formule par un tableur", () => {
    for (const start of ["=", "+", "-", "@", "\t", "\r"]) {
      const comment = { ...row, comment: `${start}HYPERLINK("http://x")` };
      const csv = measurementsCsv([comment], { timeZone: "UTC", labels });
      expect(csv, JSON.stringify(start)).toContain(`'${start}HYPERLINK`);
    }
  });

  it("sans mesure, ne contient que l'en-tête", () => {
    expect(lines(measurementsCsv([], { timeZone: "UTC", labels }))).toEqual([HEADER, ""]);
  });
});
