import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDELINE, GUIDELINES, guidelineOf, isGuidelineId, positionOf } from "./guideline";

describe("référentiels", () => {
  it("SFHTA par défaut, seuil d'automesure 135/85", () => {
    expect(DEFAULT_GUIDELINE).toBe("sfhta");
    expect(guidelineOf("sfhta")).toMatchObject({ acronym: "SFHTA", threshold: { systolic: 135, diastolic: 85 } });
  });

  it("seuils : 135/85 pour SFHTA, ESH, ESC, ISH, NICE et JSH ; 130/80 pour ACC/AHA et Hypertension Canada 2025", () => {
    const thresholds = Object.fromEntries(
      GUIDELINES.map((g) => [g.acronym, `${g.threshold.systolic}/${g.threshold.diastolic}`]),
    );
    expect(thresholds).toEqual({
      SFHTA: "135/85",
      "ESH 2023": "135/85",
      "ESC 2024": "135/85",
      "ISH 2020": "135/85",
      NICE: "135/85",
      JSH: "135/85",
      "ACC/AHA 2017": "130/80",
      "Hypertension Canada 2025": "130/80",
    });
  });

  it("chaque référentiel a son nom complet et une explication en français et en anglais", () => {
    for (const guideline of GUIDELINES) {
      for (const locale of ["fr", "en"] as const) {
        expect(guideline.name[locale].length).toBeGreaterThan(guideline.acronym.length);
        expect(guideline.explanation[locale].length).toBeGreaterThan(20);
      }
    }
  });

  it("aucun pays ne sert à choisir un référentiel (ADR-0007) : l'identifiant suffit", () => {
    expect(isGuidelineId("esc2024")).toBe(true);
    expect(isGuidelineId("france")).toBe(false);
    expect(new Set(GUIDELINES.map((g) => g.id)).size).toBe(GUIDELINES.length);
  });
});

describe("position par rapport au seuil", () => {
  const threshold = { systolic: 135, diastolic: 85 };

  it("sous le seuil quand la systolique et la diastolique sont toutes deux en dessous", () => {
    expect(positionOf({ systolic: 134.9, diastolic: 84.9 }, threshold)).toBe("below");
  });

  it("au-dessus dès que l'une des deux atteint le seuil", () => {
    expect(positionOf({ systolic: 135, diastolic: 70 }, threshold)).toBe("above");
    expect(positionOf({ systolic: 120, diastolic: 85 }, threshold)).toBe("above");
    expect(positionOf({ systolic: 150, diastolic: 95 }, threshold)).toBe("above");
  });

  it("change avec le référentiel : 132/82 est sous le seuil SFHTA mais au-dessus de celui de l'ACC/AHA", () => {
    const average = { systolic: 132, diastolic: 82 };
    expect(positionOf(average, guidelineOf("sfhta").threshold)).toBe("below");
    expect(positionOf(average, guidelineOf("accAha2017").threshold)).toBe("above");
  });
});
