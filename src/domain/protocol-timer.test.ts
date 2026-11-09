import { describe, expect, it } from "vitest";
import {
  afterMeasurementStarted,
  formatCountdown,
  pauseTimer,
  remainingSeconds,
  restartTimer,
  resumeTimer,
  startInterval,
  startRest,
} from "./protocol-timer";

const now = Date.parse("2026-11-09T07:30:00Z");

describe("minuteur du protocole de mesure", () => {
  it("le repos dure 5 minutes avant la mesure 1", () => {
    const rest = startRest(now);
    expect(rest.measurement).toBe(1);
    expect(remainingSeconds(rest, now)).toBe(300);
    expect(remainingSeconds(rest, now + 299_500)).toBe(1);
    expect(remainingSeconds(rest, now + 300_000)).toBe(0);
    expect(remainingSeconds(rest, now + 400_000)).toBe(0);
    // Une horloge lue avant le départ ne rallonge pas le décompte.
    expect(remainingSeconds(rest, now - 60_000)).toBe(300);
  });

  it("commencer la mesure 1 ou 2 lance 1 minute avant la suivante, la mesure 3 arrête le décompte", () => {
    expect(afterMeasurementStarted(0, now)).toEqual({ measurement: 2, startedAt: now, endsAt: now + 60_000, pausedAt: null });
    expect(afterMeasurementStarted(1, now)).toEqual({ measurement: 3, startedAt: now, endsAt: now + 60_000, pausedAt: null });
    expect(afterMeasurementStarted(2, now)).toBeNull();
  });

  it("un intervalle lancé à la main dure 1 minute, avant la mesure suivante sans numéro", () => {
    expect(startInterval(now)).toEqual({ measurement: null, startedAt: now, endsAt: now + 60_000, pausedAt: null });
  });

  it("en pause, le temps restant est figé ; à la reprise, il repart de là", () => {
    const paused = pauseTimer(startRest(now), now + 100_000);
    expect(remainingSeconds(paused, now + 100_000)).toBe(200);
    expect(remainingSeconds(paused, now + 900_000)).toBe(200);
    // Une seconde pause ne change rien.
    expect(pauseTimer(paused, now + 500_000)).toBe(paused);

    const resumed = resumeTimer(paused, now + 400_000);
    expect(resumed.pausedAt).toBeNull();
    expect(remainingSeconds(resumed, now + 400_000)).toBe(200);
    expect(remainingSeconds(resumed, now + 450_000)).toBe(150);
    expect(remainingSeconds(resumed, now + 600_000)).toBe(0);
  });

  it("recommencer repart de la durée complète, pour la même mesure, même après une pause", () => {
    const paused = pauseTimer(afterMeasurementStarted(0, now)!, now + 40_000);
    const resumed = resumeTimer(paused, now + 70_000);
    const restarted = restartTimer(resumed, now + 80_000);
    expect(restarted.measurement).toBe(2);
    expect(restarted.pausedAt).toBeNull();
    expect(remainingSeconds(restarted, now + 80_000)).toBe(60);
    expect(remainingSeconds(restartTimer(paused, now + 50_000), now + 50_000)).toBe(60);
  });

  it("affiche le décompte en m:ss", () => {
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
  });
});
