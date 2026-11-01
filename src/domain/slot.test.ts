import { describe, expect, it } from "vitest";
import { momentAt } from "./slot";

describe("moment d'un créneau selon l'heure locale du fuseau", () => {
  it.each([
    ["00:00", "morning"],
    ["11:59", "morning"],
    ["12:00", "evening"],
    ["23:59", "evening"],
  ])("à %s à Paris : %s", (time, moment) => {
    expect(momentAt(new Date(`2026-10-31T${time}:00+01:00`), "Europe/Paris")).toBe(moment);
  });

  it("le même instant est le matin à Paris et le soir à New York", () => {
    const instant = new Date("2026-02-02T03:00:00Z");
    expect(momentAt(instant, "Europe/Paris")).toBe("morning");
    expect(momentAt(instant, "America/New_York")).toBe("evening");
  });
});
