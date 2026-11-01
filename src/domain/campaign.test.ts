import { describe, expect, it } from "vitest";
import {
  attachMeasurement,
  campaignOverview,
  scheduleCampaign,
  type CampaignInput,
  type CampaignMeasurement,
} from "./campaign";
import type { CampaignDay, Moment } from "./slot";

const TZ = "Europe/Paris";

/** Un instant à une heure locale de Paris (hiver UTC+1 sauf mention). */
const paris = (local: string, offset = "+01:00") => new Date(`${local}:00${offset}`);

let nextId = 0;
function measure(
  campaignId: string | null,
  day: CampaignDay | null,
  moment: Moment,
  takenAt: Date,
  values: { systolic: number; diastolic: number; pulse?: number } = { systolic: 130, diastolic: 80 },
): CampaignMeasurement {
  nextId += 1;
  return {
    id: `m${nextId}`,
    campaignId,
    campaignDay: day,
    moment,
    takenAt,
    systolic: values.systolic,
    diastolic: values.diastolic,
    pulse: values.pulse ?? 70,
  };
}

/** Les 18 mesures d'une campagne commencée le 2 février 2026, toutes à 130/80 sauf indication. */
function fullCampaign(
  id: string,
  value: (day: CampaignDay, moment: Moment) => { systolic: number; diastolic: number; pulse?: number } = () => ({
    systolic: 130,
    diastolic: 80,
  }),
) {
  const measurements: CampaignMeasurement[] = [];
  for (const day of [1, 2, 3] as const) {
    for (const moment of ["morning", "evening"] as const) {
      const hour = moment === "morning" ? "07:00" : "21:00";
      for (let i = 0; i < 3; i += 1) {
        measurements.push(measure(id, day, moment, paris(`2026-02-0${1 + day}T${hour}`), value(day, moment)));
      }
    }
  }
  return measurements;
}

const input = (overrides: Partial<CampaignInput>): CampaignInput => ({
  campaigns: [],
  measurements: [],
  frequencyMonths: 3,
  timeZone: TZ,
  now: paris("2026-02-01T10:00"),
  ...overrides,
});

describe("planification", () => {
  it("sans campagne : rien de planifié", () => {
    const overview = campaignOverview(input({}));
    expect(overview.campaigns).toEqual([]);
    expect(overview.next).toBeNull();
    expect(overview.current).toBeNull();
  });

  it("la première campagne est planifiée à la date choisie", () => {
    const overview = campaignOverview(
      input({ campaigns: [{ id: "c1", plannedStart: "2026-02-10" }] }),
    );
    expect(overview.campaigns).toMatchObject([{ id: "c1", status: "planned", plannedStart: "2026-02-10" }]);
    expect(overview.next).toMatchObject({ campaignId: "c1", plannedStart: "2026-02-10" });
  });

  it("la suivante est planifiée au début de la précédente plus la fréquence", () => {
    const campaigns = [{ id: "c1", plannedStart: "2026-02-02" }];
    const measurements = fullCampaign("c1");
    const now = paris("2026-02-10T10:00");
    expect(campaignOverview(input({ campaigns, measurements, now })).next).toMatchObject({
      campaignId: null,
      plannedStart: "2026-05-02",
    });
    expect(campaignOverview(input({ campaigns, measurements, now, frequencyMonths: 1 })).next).toMatchObject({
      campaignId: null,
      plannedStart: "2026-03-02",
    });
  });

  it("le début réel est le jour de la première mesure, et la suivante en découle", () => {
    // Prévue le 1er février, commencée le 2 au soir.
    const campaigns = [{ id: "c1", plannedStart: "2026-02-01" }];
    const measurements = [measure("c1", 1, "evening", paris("2026-02-02T21:00"))];
    const overview = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-02T22:00") }));
    expect(overview.campaigns[0]).toMatchObject({
      plannedStart: "2026-02-01",
      actualStart: "2026-02-02",
      endDate: "2026-02-04",
      status: "inProgress",
    });
    expect(overview.next).toMatchObject({ campaignId: null, plannedStart: "2026-05-02" });
  });

  it("avance ou reporte une campagne planifiée, à partir d'aujourd'hui", () => {
    const planned = input({ campaigns: [{ id: "c1", plannedStart: "2026-02-10" }] });
    expect(scheduleCampaign(planned, "2026-02-01")).toEqual({ kind: "move", campaignId: "c1" });
    expect(scheduleCampaign(planned, "2026-03-15")).toEqual({ kind: "move", campaignId: "c1" });
    expect(scheduleCampaign(planned, "2026-01-31")).toEqual({ kind: "error", reason: "past" });
  });

  it("planifier sans campagne crée la première ; après une campagne, crée la suivante calculée", () => {
    expect(scheduleCampaign(input({}), "2026-02-03")).toEqual({ kind: "create", originalStart: null });
    const done = input({
      campaigns: [{ id: "c1", plannedStart: "2026-02-02" }],
      measurements: fullCampaign("c1"),
      now: paris("2026-02-10T10:00"),
    });
    expect(scheduleCampaign(done, "2026-04-01")).toEqual({ kind: "create", originalStart: null });
  });

  it("pendant une campagne en cours, la suivante ne peut pas commencer avant sa fin", () => {
    const running = input({
      campaigns: [{ id: "c1", plannedStart: "2026-02-02" }],
      measurements: [measure("c1", 1, "morning", paris("2026-02-02T07:00"))],
      now: paris("2026-02-03T10:00"),
    });
    expect(scheduleCampaign(running, "2026-02-04")).toEqual({ kind: "error", reason: "overlap" });
    expect(scheduleCampaign(running, "2026-02-05")).toEqual({ kind: "create", originalStart: null });
  });
});

describe("statuts et complétude", () => {
  const campaigns = [{ id: "c1", plannedStart: "2026-02-02" }];

  it("planifiée le jour prévu tant qu'aucune mesure n'est saisie", () => {
    const overview = campaignOverview(input({ campaigns, now: paris("2026-02-02T07:00") }));
    expect(overview.campaigns[0]).toMatchObject({ status: "planned", actualStart: null, completeness: 0 });
    expect(overview.todaySlots).toEqual({
      campaignId: "c1",
      slots: [
        { day: 1, moment: "morning", date: "2026-02-02", count: 0, filled: false },
        { day: 1, moment: "evening", date: "2026-02-02", count: 0, filled: false },
      ],
    });
    expect(overview.moment).toBe("morning");
  });

  it("en cours : le créneau du jour et la progression", () => {
    const measurements = [
      measure("c1", 1, "morning", paris("2026-02-02T07:00")),
      measure("c1", 1, "morning", paris("2026-02-02T07:02")),
      measure("c1", 1, "evening", paris("2026-02-02T21:00")),
      measure("c1", 2, "morning", paris("2026-02-03T07:00")),
    ];
    const overview = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-03T19:00") }));
    expect(overview.current).toMatchObject({ id: "c1", status: "inProgress", completeness: 4 });
    expect(overview.moment).toBe("evening");
    expect(overview.todaySlots).toEqual({
      campaignId: "c1",
      slots: [
        { day: 2, moment: "morning", date: "2026-02-03", count: 1, filled: true },
        { day: 2, moment: "evening", date: "2026-02-03", count: 0, filled: false },
      ],
    });
  });

  it("terminée avec ses 18 mesures", () => {
    const overview = campaignOverview(
      input({ campaigns, measurements: fullCampaign("c1"), now: paris("2026-02-05T00:30") }),
    );
    expect(overview.campaigns[0]).toMatchObject({ status: "finished", completeness: 18, missingSlots: [] });
    expect(overview.current).toBeNull();
    expect(overview.todaySlots).toBeNull();
  });

  it("incomplète : n/18 et la liste des créneaux manquants", () => {
    const measurements = fullCampaign("c1").filter(
      (m, i) => !(m.campaignDay === 2 && m.moment === "evening") && !(m.campaignDay === 3 && i % 3 === 0),
    );
    const overview = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-05T08:00") }));
    expect(overview.campaigns[0]).toMatchObject({
      status: "incomplete",
      completeness: 13,
      missingSlots: [{ day: 2, moment: "evening" }],
    });
  });

  it("au-delà de 3 mesures dans un créneau, la complétude n'en compte que 3", () => {
    const measurements = [1, 2, 3, 4].map(() => measure("c1", 1, "morning", paris("2026-02-02T07:00")));
    const view = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-02T09:00") })).current;
    expect(view?.completeness).toBe(3);
    expect(view?.averages.global?.count).toBe(4);
  });

  it("manquée quand sa fenêtre de début en retard (7 jours) passe sans mesure", () => {
    expect(campaignOverview(input({ campaigns, now: paris("2026-02-08T23:30") })).campaigns[0]?.status).toBe("planned");
    const overview = campaignOverview(input({ campaigns, now: paris("2026-02-09T00:30") }));
    expect(overview.campaigns[0]).toMatchObject({ id: "c1", status: "missed", completeness: 0 });
  });
});

describe("moyennes (SFHTA, ADR-0005)", () => {
  const campaigns = [{ id: "c1", plannedStart: "2026-02-02" }];

  it("sur 18 mesures, sans écarter le premier jour ; moyenne du matin et du soir", () => {
    // Matin 140/90 (pouls 60), soir 120/70 (pouls 80) ; le J1 n'est pas écarté.
    const measurements = fullCampaign("c1", (_day, moment) =>
      moment === "morning" ? { systolic: 140, diastolic: 90, pulse: 60 } : { systolic: 120, diastolic: 70, pulse: 80 },
    );
    const view = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-10T08:00") })).campaigns[0];
    expect(view?.averages.global).toEqual({ systolic: 130, diastolic: 80, pulse: 70, count: 18 });
    expect(view?.averages.morning).toEqual({ systolic: 140, diastolic: 90, pulse: 60, count: 9 });
    expect(view?.averages.evening).toEqual({ systolic: 120, diastolic: 70, pulse: 80, count: 9 });
  });

  it("sur une campagne incomplète, la moyenne porte sur les mesures présentes", () => {
    const measurements = [
      measure("c1", 1, "morning", paris("2026-02-02T07:00"), { systolic: 150, diastolic: 95, pulse: 70 }),
      measure("c1", 1, "morning", paris("2026-02-02T07:02"), { systolic: 140, diastolic: 85, pulse: 74 }),
      measure("c1", 3, "morning", paris("2026-02-04T07:00"), { systolic: 130, diastolic: 90, pulse: 72 }),
    ];
    const view = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-10T08:00") })).campaigns[0];
    expect(view?.status).toBe("incomplete");
    expect(view?.averages.global).toEqual({ systolic: 140, diastolic: 90, pulse: 72, count: 3 });
    expect(view?.averages.morning).toEqual({ systolic: 140, diastolic: 90, pulse: 72, count: 3 });
    expect(view?.averages.evening).toBeNull();
  });

  it("les mesures libres n'entrent jamais dans une moyenne de campagne", () => {
    const measurements = [
      measure("c1", 1, "morning", paris("2026-02-02T07:00"), { systolic: 130, diastolic: 80 }),
      measure(null, null, "morning", paris("2026-02-02T07:30"), { systolic: 200, diastolic: 120 }),
    ];
    const view = campaignOverview(input({ campaigns, measurements, now: paris("2026-02-02T08:00") })).current;
    expect(view?.averages.global).toMatchObject({ systolic: 130, count: 1 });
  });
});

describe("rattachement d'une saisie", () => {
  it("hors campagne, c'est une mesure libre", () => {
    expect(attachMeasurement(input({}), paris("2026-02-01T07:00"))).toEqual({ kind: "free" });
    const planned = input({ campaigns: [{ id: "c1", plannedStart: "2026-02-10" }] });
    expect(attachMeasurement(planned, paris("2026-02-01T07:00"))).toEqual({ kind: "free" });
  });

  it("pendant la période prévue, la première saisie commence la campagne en J1", () => {
    const planned = input({ campaigns: [{ id: "c1", plannedStart: "2026-02-02" }], now: paris("2026-02-03T07:00") });
    expect(attachMeasurement(planned, paris("2026-02-03T07:00"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
      day: 1,
      dropCatchUps: [],
    });
  });

  it("dans une campagne commencée, au bon jour ; avant ou après ses 3 jours, une mesure libre", () => {
    const running = input({
      campaigns: [{ id: "c1", plannedStart: "2026-02-02" }],
      measurements: [measure("c1", 1, "evening", paris("2026-02-03T21:00"))],
      now: paris("2026-02-05T07:00"),
    });
    expect(attachMeasurement(running, paris("2026-02-05T07:00"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
      day: 3,
      dropCatchUps: [],
    });
    expect(attachMeasurement(running, paris("2026-02-04T21:00"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
      day: 2,
      dropCatchUps: [],
    });
    expect(attachMeasurement(running, paris("2026-02-06T07:00"))).toEqual({ kind: "free" });
    expect(attachMeasurement(running, paris("2026-02-02T21:00"))).toEqual({ kind: "free" });
  });

  it("pendant la prochaine campagne calculée, la saisie la crée à sa date prévue", () => {
    const done = input({
      campaigns: [{ id: "c1", plannedStart: "2026-02-02" }],
      measurements: fullCampaign("c1"),
      now: paris("2026-05-03T07:00", "+02:00"),
    });
    expect(attachMeasurement(done, paris("2026-05-03T07:00", "+02:00"))).toEqual({
      kind: "newCampaign",
      plannedStart: "2026-05-02",
      originalStart: null,
      day: 1,
      dropCatchUps: [],
    });
  });
});

describe("fuseau de l'utilisateur et changement d'heure", () => {
  it("compte les jours de campagne en heure locale à travers le passage à l'heure d'été", () => {
    // Commencée le samedi 28 mars 2026 à Paris ; l'heure d'été commence le 29 mars.
    const running = input({
      campaigns: [{ id: "c1", plannedStart: "2026-03-28" }],
      measurements: [measure("c1", 1, "morning", paris("2026-03-28T07:00"))],
      now: paris("2026-03-30T00:30", "+02:00"),
    });
    // Le lundi 30 mars à 00:30 (heure d'été) est J3, pas encore la fin.
    expect(campaignOverview(running).current).toMatchObject({ endDate: "2026-03-30", status: "inProgress" });
    expect(attachMeasurement(running, paris("2026-03-30T00:30", "+02:00"))).toMatchObject({ day: 3 });
    // Le dimanche 29 à 23:30 heure d'été (21:30 UTC) est encore J2.
    expect(attachMeasurement(running, new Date("2026-03-29T21:30:00Z"))).toMatchObject({ day: 2 });
    // Le mardi 31 à 00:30, elle est terminée.
    expect(campaignOverview({ ...running, now: paris("2026-03-31T00:30", "+02:00") }).campaigns[0]?.status).toBe(
      "incomplete",
    );
  });

  it("le même instant tombe un autre jour dans un autre fuseau", () => {
    const base = {
      campaigns: [{ id: "c1", plannedStart: "2026-02-02" }],
      measurements: [measure("c1", 1, "morning", new Date("2026-02-02T12:00:00Z"))],
      now: new Date("2026-02-04T23:30:00Z"),
    };
    // À Paris il est 00:30 le 5 : terminée. À New York il est 18:30 le 4 : J3, en cours.
    expect(campaignOverview(input({ ...base, timeZone: "Europe/Paris" })).current).toBeNull();
    const newYork = campaignOverview(input({ ...base, timeZone: "America/New_York" }));
    expect(newYork.current).toMatchObject({ id: "c1" });
    expect(newYork.moment).toBe("evening");
  });
});
