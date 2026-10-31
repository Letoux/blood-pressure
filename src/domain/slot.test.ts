import { describe, expect, it } from "vitest";
import { momentAt } from "./slot";

describe("moment d'un créneau selon l'heure", () => {
  it.each([
    ["00:00", "morning"],
    ["11:59", "morning"],
    ["12:00", "evening"],
    ["23:59", "evening"],
  ])("à %s : %s", (time, moment) => {
    const [hours, minutes] = time.split(":").map(Number);
    expect(momentAt(new Date(2026, 9, 31, hours, minutes))).toBe(moment);
  });
});
