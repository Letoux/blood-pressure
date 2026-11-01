import { describe, expect, it } from "vitest";
import { measurementsCsv, type CsvLabels, type ExportedMeasurement } from "./measurements-csv";

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
    campaignStatus: "Statut de la campagne",
  },
  moments: { morning: "Matin", evening: "Soir" },
  statuses: {
    planned: "Planifiée",
    inProgress: "En cours",
    finished: "Terminée",
    incomplete: "Incomplète",
    missed: "Manquée",
    skipped: "Sautée",
  },
  yes: "oui",
  no: "non",
};

const HEADER =
  "Date,Heure,Fuseau horaire,Systolique (mmHg),Diastolique (mmHg),Pouls (bpm),Commentaire,Mesure libre,Campagne,Jour de campagne,Moment,Statut de la campagne";

const row: ExportedMeasurement = {
  takenAt: new Date("2026-10-30T06:30:00Z"),
  systolic: 132,
  diastolic: 84,
  pulse: 72,
  comment: null,
  moment: "morning",
  campaign: null,
  campaignDay: null,
  campaignStatus: null,
};

/** Lignes du CSV, sans le BOM. */
function lines(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n");
}

const csvOf = (measurements: ExportedMeasurement[], timeZone = "UTC") =>
  measurementsCsv(measurements, [], { timeZone, labels });

describe("export CSV des mesures", () => {
  it("commence par un BOM UTF-8, sépare les lignes par CRLF et donne l'heure dans le fuseau demandé", () => {
    const csv = csvOf([row], "Europe/Paris");

    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines(csv)).toEqual([HEADER, "2026-10-30,07:30,Europe/Paris,132,84,72,,oui,,,Matin,", ""]);
  });

  it("suit le changement d'heure et le changement de jour du fuseau", () => {
    const summer = { ...row, takenAt: new Date("2026-07-01T06:30:00Z") };
    const tokyo = { ...row, takenAt: new Date("2026-10-30T20:15:00Z"), moment: "evening" as const };

    expect(lines(csvOf([summer], "Europe/Paris"))[1]).toMatch(/^2026-07-01,08:30,/);
    expect(lines(csvOf([tokyo], "Asia/Tokyo"))[1]).toMatch(/^2026-10-31,05:15,Asia\/Tokyo,.*,Soir,$/);
  });

  it("donne minuit en 00:00", () => {
    const midnight = { ...row, takenAt: new Date("2026-10-30T23:00:00Z") };

    expect(lines(csvOf([midnight], "Europe/Paris"))[1]).toMatch(/^2026-10-31,00:00,/);
  });

  it("indique la campagne (sa date de début), son jour et son statut pour une mesure de campagne", () => {
    const inCampaign = { ...row, campaign: "2026-10-29", campaignDay: 2, campaignStatus: "incomplete" as const };

    expect(lines(csvOf([inCampaign]))[1]).toBe("2026-10-30,06:30,UTC,132,84,72,,non,2026-10-29,2,Matin,Incomplète");
  });

  it("ajoute une ligne sans mesure pour chaque campagne manquée ou sautée, à sa date prévue", () => {
    const later = { ...row, takenAt: new Date("2026-11-20T06:30:00Z") };
    const csv = measurementsCsv(
      [row, later],
      [
        { plannedStart: "2026-11-02", status: "missed" },
        { plannedStart: "2026-11-09", status: "skipped" },
      ],
      { timeZone: "UTC", labels },
    );

    expect(lines(csv).slice(1, 5)).toEqual([
      "2026-10-30,06:30,UTC,132,84,72,,oui,,,Matin,",
      "2026-11-02,,UTC,,,,,non,2026-11-02,,,Manquée",
      "2026-11-09,,UTC,,,,,non,2026-11-09,,,Sautée",
      "2026-11-20,06:30,UTC,132,84,72,,oui,,,Matin,",
    ]);
  });

  it("met entre guillemets les commentaires avec virgule, guillemet ou retour à la ligne (RFC 4180)", () => {
    const comment = { ...row, comment: 'Stress, "café"\nmal dormi' };

    expect(csvOf([comment])).toContain(',"Stress, ""café""\nmal dormi",');
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("neutralise un commentaire commençant par %j (formule de tableur)", (start) => {
    const comment = { ...row, comment: `${start}HYPERLINK("http://x")` };
    expect(csvOf([comment])).toContain(`'${start}HYPERLINK`);
  });

  it("sans mesure, ne contient que l'en-tête", () => {
    expect(lines(csvOf([]))).toEqual([HEADER, ""]);
  });
});
