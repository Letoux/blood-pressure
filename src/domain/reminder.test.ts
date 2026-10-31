import { describe, expect, it } from "vitest";
import { FOLLOW_UP_DELAY_MINUTES, isTimeOfDay, REMINDER_DEFAULTS } from "./reminder";

describe("heure d'un rappel", () => {
  it("accepte une heure HH:MM de 00:00 à 23:59", () => {
    for (const time of ["00:00", "07:30", "12:05", "23:59"]) expect(isTimeOfDay(time), time).toBe(true);
  });

  it("refuse une heure hors bornes ou mal écrite", () => {
    for (const time of ["24:00", "07:60", "7:30", "07h30", "07:30:00", "", " 07:30"]) {
      expect(isTimeOfDay(time), time).toBe(false);
    }
  });
});

describe("préférences de rappel par défaut", () => {
  it("rappel la veille activé, relance désactivée, heures du matin et du soir valides", () => {
    expect(REMINDER_DEFAULTS.dayBeforeReminder).toBe(true);
    expect(REMINDER_DEFAULTS.followUpEnabled).toBe(false);
    expect(isTimeOfDay(REMINDER_DEFAULTS.morningTime)).toBe(true);
    expect(isTimeOfDay(REMINDER_DEFAULTS.eveningTime)).toBe(true);
    expect(REMINDER_DEFAULTS.followUpDelayMinutes).toBeGreaterThanOrEqual(FOLLOW_UP_DELAY_MINUTES.min);
    expect(REMINDER_DEFAULTS.followUpDelayMinutes).toBeLessThanOrEqual(FOLLOW_UP_DELAY_MINUTES.max);
  });
});
