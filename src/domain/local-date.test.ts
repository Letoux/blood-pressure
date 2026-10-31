import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, isLocalDate, isTimeZone, localDateOf, localHourOf } from "./local-date";

describe("jour local d'un instant dans un fuseau", () => {
  it("dépend du fuseau de l'utilisateur", () => {
    const instant = new Date("2026-10-30T23:30:00Z");
    expect(localDateOf(instant, "Europe/Paris")).toBe("2026-10-31");
    expect(localDateOf(instant, "UTC")).toBe("2026-10-30");
    expect(localDateOf(instant, "America/New_York")).toBe("2026-10-30");
    expect(localDateOf(new Date("2026-10-31T03:00:00Z"), "America/Los_Angeles")).toBe("2026-10-30");
  });

  it("reste juste au changement d'heure (Paris, passage à l'heure d'été le 29 mars 2026)", () => {
    // 23:30 le 28 mars à Paris (UTC+1), puis 00:30 le 29 mars après minuit, encore en UTC+1.
    expect(localDateOf(new Date("2026-03-28T22:30:00Z"), "Europe/Paris")).toBe("2026-03-28");
    expect(localDateOf(new Date("2026-03-28T23:30:00Z"), "Europe/Paris")).toBe("2026-03-29");
    // 23:30 le 29 mars à Paris, désormais en UTC+2.
    expect(localDateOf(new Date("2026-03-29T21:30:00Z"), "Europe/Paris")).toBe("2026-03-29");
    expect(localDateOf(new Date("2026-03-29T22:30:00Z"), "Europe/Paris")).toBe("2026-03-30");
  });

  it("donne l'heure locale, changement d'heure compris", () => {
    expect(localHourOf(new Date("2026-03-29T06:00:00Z"), "Europe/Paris")).toBe(8);
    expect(localHourOf(new Date("2026-03-28T06:00:00Z"), "Europe/Paris")).toBe(7);
    expect(localHourOf(new Date("2026-10-31T23:30:00Z"), "Europe/Paris")).toBe(0);
  });
});

describe("calendrier", () => {
  it("ajoute des jours, en traversant les mois, les années et le changement d'heure", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("ajoute des mois, en restant au dernier jour d'un mois plus court", () => {
    expect(addMonths("2026-01-15", 3)).toBe("2026-04-15");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-05-10", 12)).toBe("2027-05-10");
  });

  it("compte les jours entre deux dates", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-03-30", "2026-03-28")).toBe(-2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("reconnaît une date et un fuseau valides", () => {
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-2-3")).toBe(false);
    expect(isTimeZone("Europe/Paris")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});
