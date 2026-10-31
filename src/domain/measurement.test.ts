import { describe, expect, it } from "vitest";
import { isAlertValue, readEntryRows, validateMeasurement } from "./measurement";

const valid = { systolic: 120, diastolic: 80, pulse: 70 };

describe("validation d'une mesure", () => {
  it("accepte une mesure ordinaire", () => {
    expect(validateMeasurement(valid)).toEqual([]);
  });

  it.each([
    [59, ["systolicOutOfRange"]],
    [60, []],
    [260, []],
    [261, ["systolicOutOfRange"]],
  ])("systolique %i : %j", (systolic, errors) => {
    expect(validateMeasurement({ ...valid, systolic, diastolic: 50 })).toEqual(errors);
  });

  it.each([
    [29, ["diastolicOutOfRange"]],
    [30, []],
    [160, []],
    [161, ["diastolicOutOfRange"]],
  ])("diastolique %i : %j", (diastolic, errors) => {
    expect(validateMeasurement({ ...valid, systolic: 200, diastolic })).toEqual(errors);
  });

  it.each([
    [29, ["pulseOutOfRange"]],
    [30, []],
    [220, []],
    [221, ["pulseOutOfRange"]],
  ])("pouls %i : %j", (pulse, errors) => {
    expect(validateMeasurement({ ...valid, pulse })).toEqual(errors);
  });

  it.each([
    [100, 100, ["systolicNotAboveDiastolic"]],
    [90, 100, ["systolicNotAboveDiastolic"]],
    [101, 100, []],
  ])("systolique %i et diastolique %i : %j", (systolic, diastolic, errors) => {
    expect(validateMeasurement({ ...valid, systolic, diastolic })).toEqual(errors);
  });

  it("ne compare pas systolique et diastolique si l'une est hors bornes", () => {
    expect(validateMeasurement({ ...valid, systolic: 50, diastolic: 80 })).toEqual(["systolicOutOfRange"]);
  });

  it("refuse une valeur non entière", () => {
    expect(validateMeasurement({ systolic: 120.5, diastolic: 80, pulse: Number.NaN })).toEqual([
      "systolicOutOfRange",
      "pulseOutOfRange",
    ]);
  });
});

describe("lignes d'un formulaire de créneau", () => {
  const blank = { systolic: "", diastolic: "", pulse: "" };

  it("garde les lignes remplies et ignore les lignes vides", () => {
    expect(
      readEntryRows([
        { systolic: "121", diastolic: " 81 ", pulse: "71" },
        { systolic: " ", diastolic: "", pulse: "" },
        { systolic: "119", diastolic: "79", pulse: "69" },
      ]),
    ).toEqual({
      ok: true,
      measurements: [
        { systolic: 121, diastolic: 81, pulse: 71 },
        { systolic: 119, diastolic: 79, pulse: 69 },
      ],
    });
  });

  it("refuse un formulaire sans aucune ligne remplie", () => {
    expect(readEntryRows([blank, blank, blank])).toEqual({
      ok: false,
      empty: true,
      rowErrors: [[], [], []],
    });
  });

  it("signale, ligne par ligne, une ligne incomplète ou une mesure invalide", () => {
    expect(
      readEntryRows([
        { systolic: "120", diastolic: "80", pulse: "" },
        { systolic: "80", diastolic: "120", pulse: "70" },
        { systolic: "12a", diastolic: "80", pulse: "70" },
      ]),
    ).toEqual({
      ok: false,
      empty: false,
      rowErrors: [["incomplete"], ["systolicNotAboveDiastolic"], ["systolicOutOfRange"]],
    });
  });
});

describe("valeur d'alerte (180/110 ou plus)", () => {
  it.each([
    [179, 109, false],
    [180, 100, true],
    [170, 110, true],
    [200, 120, true],
  ])("%i/%i : %s", (systolic, diastolic, alert) => {
    expect(isAlertValue({ systolic, diastolic })).toBe(alert);
  });
});
