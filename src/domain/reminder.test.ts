import { describe, expect, it } from "vitest";
import { campaignOverview, type CampaignMeasurement, type StoredCampaign } from "./campaign";
import {
  dueReminders,
  FOLLOW_UP_DELAY_MINUTES,
  isTimeOfDay,
  REMINDER_DEFAULTS,
  reminderPreferencesOf,
  type ReminderPreferences,
} from "./reminder";
import type { CampaignDay, Moment } from "./slot";

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

describe("préférences lues en base", () => {
  it("sans ligne de réglages, ce sont les valeurs par défaut", () => {
    expect(reminderPreferencesOf(null)).toEqual(REMINDER_DEFAULTS);
    expect(reminderPreferencesOf({ morningTime: null, followUpEnabled: null })).toEqual(REMINDER_DEFAULTS);
  });

  it("garde les valeurs enregistrées, et remplace une heure illisible par celle par défaut", () => {
    expect(
      reminderPreferencesOf({
        morningTime: "06:45",
        eveningTime: "25:00",
        dayBeforeReminder: false,
        followUpEnabled: true,
        followUpDelayMinutes: 60,
      }),
    ).toEqual({
      morningTime: "06:45",
      eveningTime: REMINDER_DEFAULTS.eveningTime,
      dayBeforeReminder: false,
      followUpEnabled: true,
      followUpDelayMinutes: 60,
    });
  });
});

// --- Rappels à envoyer (`dueReminders`) ---

const TZ = "Europe/Paris";

/** Un instant à une heure locale de Paris (`offset` : +01:00 en hiver, +02:00 en été). */
const paris = (local: string, offset = "+01:00") => new Date(`${local}:00${offset}`);

let nextId = 0;
const measure = (
  campaignId: string,
  campaignDay: CampaignDay,
  moment: Moment,
  takenAt: Date,
): CampaignMeasurement => ({
  id: `m${++nextId}`,
  campaignId,
  campaignDay,
  moment,
  takenAt,
  systolic: 130,
  diastolic: 80,
  pulse: 70,
});

/** Les rappels dus à `now`, pour des campagnes (par défaut : une, prévue le 2 février 2026). */
function due(
  now: Date,
  {
    campaigns = [{ id: "c1", plannedStart: "2026-02-02" }],
    measurements = [],
    preferences = {},
    sent = [],
    timeZone = TZ,
  }: {
    campaigns?: StoredCampaign[];
    measurements?: CampaignMeasurement[];
    preferences?: Partial<ReminderPreferences>;
    sent?: string[];
    timeZone?: string;
  } = {},
) {
  const overview = campaignOverview({ campaigns, measurements, frequencyMonths: 3, timeZone, now });
  return dueReminders({
    preferences: { ...REMINDER_DEFAULTS, ...preferences },
    timeZone,
    overview,
    sent: new Set(sent),
    now,
  });
}

describe("rappel d'un créneau", () => {
  it("part à l'heure du matin choisie, le premier jour prévu d'une campagne", () => {
    expect(due(paris("2026-02-02T07:29"))).toEqual([]);
    expect(due(paris("2026-02-02T07:30"))).toEqual([
      { kind: "slot", date: "2026-02-02", moment: "morning", day: 1, key: "slot:2026-02-02:morning" },
    ]);
  });

  it("part à l'heure du soir choisie, chaque jour d'une campagne en cours", () => {
    const measurements = [measure("c1", 1, "morning", paris("2026-02-02T07:40"))];
    expect(due(paris("2026-02-02T21:00"), { measurements })).toEqual([
      { kind: "slot", date: "2026-02-02", moment: "evening", day: 1, key: "slot:2026-02-02:evening" },
    ]);
    expect(due(paris("2026-02-04T18:15"), { measurements, preferences: { eveningTime: "18:15" } })).toEqual([
      { kind: "slot", date: "2026-02-04", moment: "evening", day: 3, key: "slot:2026-02-04:evening" },
    ]);
  });

  it("ne part pas pour un créneau déjà rempli", () => {
    const measurements = [measure("c1", 1, "morning", paris("2026-02-02T07:00"))];
    expect(due(paris("2026-02-02T07:30"), { measurements })).toEqual([]);
  });

  it("ne part jamais deux fois", () => {
    expect(due(paris("2026-02-02T07:31"), { sent: ["slot:2026-02-02:morning"] })).toEqual([]);
  });

  it("en retard (worker arrêté), part encore pendant 30 minutes, puis plus du tout", () => {
    expect(due(paris("2026-02-02T07:59")).map((r) => r.key)).toEqual(["slot:2026-02-02:morning"]);
    expect(due(paris("2026-02-02T08:00"))).toEqual([]);
    expect(due(paris("2026-02-02T13:00"))).toEqual([]);
  });

  it("hors campagne, rien ne part", () => {
    expect(due(paris("2026-02-01T07:30"))).toEqual([]);
    // Après une campagne commencée le 2, terminée le 4.
    const measurements = [measure("c1", 1, "morning", paris("2026-02-02T07:00"))];
    expect(due(paris("2026-02-05T07:30"), { measurements })).toEqual([]);
  });

  it("garde l'heure locale au changement d'heure, dans le fuseau de l'utilisateur", () => {
    // Paris passe à l'heure d'été le 29 mars 2026 et revient à l'heure d'hiver le 25 octobre.
    const spring = { campaigns: [{ id: "c1", plannedStart: "2026-03-28" }] };
    expect(due(paris("2026-03-28T07:30"), spring)).toHaveLength(1);
    expect(due(new Date("2026-03-29T05:30:00Z"), spring).map((r) => r.key)).toEqual(["slot:2026-03-29:morning"]);
    expect(due(new Date("2026-03-29T05:29:00Z"), spring)).toEqual([]);

    const autumn = { campaigns: [{ id: "c1", plannedStart: "2026-10-24" }] };
    expect(due(new Date("2026-10-24T05:30:00Z"), autumn).map((r) => r.key)).toEqual(["slot:2026-10-24:morning"]);
    expect(due(new Date("2026-10-25T06:30:00Z"), autumn).map((r) => r.key)).toEqual(["slot:2026-10-25:morning"]);
    expect(due(new Date("2026-10-25T05:30:00Z"), autumn)).toEqual([]);

    // Ailleurs : 07:30 à New York (UTC-5 en février).
    const newYork = { timeZone: "America/New_York" };
    expect(due(new Date("2026-02-02T12:30:00Z"), newYork).map((r) => r.key)).toEqual(["slot:2026-02-02:morning"]);
  });

  it("une heure qui n'existe pas (saut du printemps) part juste après le saut", () => {
    const spring = { campaigns: [{ id: "c1", plannedStart: "2026-03-29" }], preferences: { morningTime: "02:30" as const } };
    expect(due(new Date("2026-03-29T00:59:00Z"), spring)).toEqual([]);
    expect(due(new Date("2026-03-29T01:30:00Z"), spring).map((r) => r.key)).toEqual(["slot:2026-03-29:morning"]);
  });

  it("à minuit pile, part le jour même", () => {
    const options = { campaigns: [{ id: "c1", plannedStart: "2026-02-02" }], preferences: { morningTime: "00:00" as const } };
    expect(due(paris("2026-02-01T23:59"), options)).toEqual([]);
    expect(due(paris("2026-02-02T00:00"), options).map((r) => r.key)).toEqual(["slot:2026-02-02:morning"]);
  });

  it("une heure qui revient deux fois (automne) part à la première", () => {
    const autumn = { campaigns: [{ id: "c1", plannedStart: "2026-10-25" }], preferences: { morningTime: "02:30" as const } };
    expect(due(new Date("2026-10-25T00:30:00Z"), autumn).map((r) => r.key)).toEqual(["slot:2026-10-25:morning"]);
    // Une heure plus tard, la même heure locale revient : déjà envoyé, rien de plus.
    expect(due(new Date("2026-10-25T01:30:00Z"), { ...autumn, sent: ["slot:2026-10-25:morning"] })).toEqual([]);
  });
});

describe("relance", () => {
  const followUp = { followUpEnabled: true, followUpDelayMinutes: 45 };
  const sent = ["slot:2026-02-02:morning"];

  it("part après le délai choisi si le créneau n'est toujours pas rempli", () => {
    expect(due(paris("2026-02-02T08:14"), { preferences: followUp, sent })).toEqual([]);
    expect(due(paris("2026-02-02T08:15"), { preferences: followUp, sent })).toEqual([
      { kind: "followUp", date: "2026-02-02", moment: "morning", day: 1, key: "followUp:2026-02-02:morning" },
    ]);
  });

  it("ne part pas si elle est désactivée", () => {
    expect(due(paris("2026-02-02T08:15"), { preferences: { ...followUp, followUpEnabled: false }, sent })).toEqual([]);
  });

  it("ne part pas si le créneau a été rempli entre-temps", () => {
    const measurements = [measure("c1", 1, "morning", paris("2026-02-02T07:50"))];
    expect(due(paris("2026-02-02T08:15"), { preferences: followUp, sent, measurements })).toEqual([]);
  });

  it("ne part jamais deux fois", () => {
    const both = [...sent, "followUp:2026-02-02:morning"];
    expect(due(paris("2026-02-02T08:16"), { preferences: followUp, sent: both })).toEqual([]);
  });

  it("remplace le rappel s'ils sont tous deux en retard : une seule notification par créneau", () => {
    const short = { followUpEnabled: true, followUpDelayMinutes: 15 };
    // Worker arrêté de 07:00 à 07:50 : le rappel de 07:30 et la relance de 07:45 sont en retard.
    expect(due(paris("2026-02-02T07:50"), { preferences: short }).map((r) => r.key)).toEqual([
      "followUp:2026-02-02:morning",
    ]);
    // La minute suivante, le rappel n'est plus dû non plus.
    expect(due(paris("2026-02-02T07:51"), { preferences: short, sent: ["followUp:2026-02-02:morning"] })).toEqual([]);
  });

  it("ne part pas après minuit : le créneau du soir est clos", () => {
    const options = {
      preferences: { eveningTime: "23:30" as const, followUpEnabled: true, followUpDelayMinutes: 60 },
      sent: ["slot:2026-02-02:evening"],
    };
    expect(due(paris("2026-02-03T00:30"), options)).toEqual([]);
  });
});

describe("rappel de la veille", () => {
  const dayBefore = { kind: "dayBefore", date: "2026-02-02", moment: null, day: null, key: "dayBefore:2026-02-02:-" };

  it("part la veille du début prévu, à l'heure du soir", () => {
    expect(due(paris("2026-02-01T20:59"))).toEqual([]);
    expect(due(paris("2026-02-01T21:00"))).toEqual([dayBefore]);
    expect(due(paris("2026-01-31T21:00"))).toEqual([]);
  });

  it("ne part pas s'il est désactivé, ni deux fois", () => {
    expect(due(paris("2026-02-01T21:00"), { preferences: { dayBeforeReminder: false } })).toEqual([]);
    expect(due(paris("2026-02-01T21:05"), { sent: [dayBefore.key] })).toEqual([]);
  });

  it("vaut aussi pour la prochaine campagne calculée (pas encore enregistrée)", () => {
    const campaigns = [{ id: "c0", plannedStart: "2025-11-02" }];
    const measurements = [measure("c0", 1, "morning", paris("2025-11-02T07:30"))];
    expect(due(paris("2026-02-01T21:00"), { campaigns, measurements })).toEqual([dayBefore]);
    expect(due(paris("2026-02-02T07:30"), { campaigns, measurements }).map((r) => r.key)).toEqual([
      "slot:2026-02-02:morning",
    ]);
  });
});

describe("début en retard, rattrapage et campagne sautée (ADR-0011)", () => {
  // La campagne prévue le 2 février peut commencer jusqu'au 8 ; sans mesure, elle est manquée le
  // 9 et un rattrapage commence le jour même, puis le 16 s'il est manqué à son tour.
  it("en retard, le rappel de J1 part chaque jour de la fenêtre de début", () => {
    expect(due(paris("2026-02-05T07:30")).map((r) => r.key)).toEqual(["slot:2026-02-05:morning"]);
    expect(due(paris("2026-02-08T21:00")).map((r) => r.key)).toEqual(["slot:2026-02-08:evening"]);
  });

  it("les rappels suivent les campagnes de rattrapage, tant qu'elles sont manquées", () => {
    expect(due(paris("2026-02-09T07:30"))).toEqual([
      { kind: "slot", date: "2026-02-09", moment: "morning", day: 1, key: "slot:2026-02-09:morning" },
    ]);
    expect(due(paris("2026-02-16T21:00")).map((r) => r.key)).toEqual(["slot:2026-02-16:evening"]);
  });

  it("une campagne sautée n'a plus de rappel ; la veille de la suivante, si", () => {
    const campaigns: StoredCampaign[] = [{ id: "c1", plannedStart: "2026-02-02", status: "skipped", skippedOn: "2026-02-04" }];
    expect(due(paris("2026-02-05T07:30"), { campaigns })).toEqual([]);
    expect(due(paris("2026-05-01T21:00", "+02:00"), { campaigns }).map((r) => r.key)).toEqual(["dayBefore:2026-05-02:-"]);
  });
});

describe("sans campagne planifiée", () => {
  it("aucun rappel", () => {
    expect(due(paris("2026-02-02T07:30"), { campaigns: [] })).toEqual([]);
    expect(due(paris("2026-02-01T21:00"), { campaigns: [] })).toEqual([]);
  });
});
