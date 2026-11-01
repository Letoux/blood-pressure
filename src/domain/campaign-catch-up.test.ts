// Début en retard, campagne manquée, rattrapage, campagne sautée et saisie a posteriori (ADR-0011).
import { describe, expect, it } from "vitest";
import {
  attachMeasurement,
  campaignOverview,
  missedCampaignsToRecord,
  scheduleCampaign,
  skipCampaign,
  type CampaignInput,
  type CampaignMeasurement,
} from "./campaign";
import type { CampaignDay, Moment } from "./slot";

/** Un instant à une heure locale de Paris (hiver, UTC+1). */
const paris = (local: string) => new Date(`${local}:00+01:00`);

let nextId = 0;
function measure(campaignId: string, day: CampaignDay, moment: Moment, takenAt: Date): CampaignMeasurement {
  nextId += 1;
  return { id: `m${nextId}`, campaignId, campaignDay: day, moment, takenAt, systolic: 130, diastolic: 80, pulse: 70 };
}

const input = (overrides: Partial<CampaignInput>): CampaignInput => ({
  campaigns: [],
  measurements: [],
  frequencyMonths: 3,
  timeZone: "Europe/Paris",
  now: paris("2026-02-01T10:00"),
  ...overrides,
});

describe("début en retard, campagne manquée et rattrapage", () => {
  const campaigns = [{ id: "c1", plannedStart: "2026-02-02" }];

  it("une première mesure jusqu'à J+6 commence la campagne en retard : ce jour devient J1", () => {
    const late = input({ campaigns, now: paris("2026-02-08T10:00") });
    const overview = campaignOverview(late);
    expect(overview.campaigns[0]).toMatchObject({ status: "planned" });
    expect(overview.next).toEqual({
      campaignId: "c1",
      plannedStart: "2026-02-02",
      startBy: "2026-02-08",
      catchUp: false,
      originalStart: null,
      late: true,
      skippable: true,
    });
    expect(overview.todaySlots?.slots.map((slot) => [slot.day, slot.date])).toEqual([
      [1, "2026-02-08"],
      [1, "2026-02-08"],
    ]);
    expect(attachMeasurement(late, paris("2026-02-08T07:00"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
      day: 1,
      dropCatchUps: [],
      renumber: [],
    });

    const started = campaignOverview(
      input({
        campaigns,
        measurements: [measure("c1", 1, "morning", paris("2026-02-08T07:00"))],
        now: paris("2026-02-08T10:00"),
      }),
    );
    expect(started.current).toMatchObject({ actualStart: "2026-02-08", endDate: "2026-02-10" });
    expect(started.next).toMatchObject({ plannedStart: "2026-05-08", catchUp: false });
  });

  it("le jour prévu n'est pas encore en retard, et une saisie la veille reste libre", () => {
    const today = input({ campaigns, now: paris("2026-02-02T10:00") });
    expect(campaignOverview(today).next).toMatchObject({ late: false, skippable: false });
    expect(attachMeasurement(today, paris("2026-02-01T21:00"))).toEqual({ kind: "free" });
  });

  it("manquée, elle est suivie dès le lendemain de sa fenêtre d'une campagne de rattrapage", () => {
    expect(campaignOverview(input({ campaigns, now: paris("2026-02-08T23:30") })).campaigns[0]?.status).toBe("planned");
    const missed = input({ campaigns, now: paris("2026-02-09T08:00") });
    const overview = campaignOverview(missed);
    expect(overview.campaigns.map((view) => [view.id, view.status])).toEqual([["c1", "missed"]]);
    expect(overview.next).toEqual({
      campaignId: null,
      plannedStart: "2026-02-09",
      startBy: "2026-02-15",
      catchUp: true,
      originalStart: "2026-02-02",
      late: false,
      skippable: true,
    });
    expect(overview.todaySlots).toMatchObject({ campaignId: null, slots: [{ day: 1, date: "2026-02-09" }, { day: 1 }] });
    expect(attachMeasurement(missed, paris("2026-02-09T07:00"))).toEqual({
      kind: "newCampaign",
      plannedStart: "2026-02-09",
      originalStart: "2026-02-02",
      day: 1,
      dropCatchUps: [],
    });
  });

  it("un rattrapage manqué reste visible et en appelle un autre, jusqu'à ce qu'il soit fait", () => {
    const overview = campaignOverview(input({ campaigns, now: paris("2026-02-17T08:00") }));
    expect(overview.campaigns).toMatchObject([
      { id: "c1", status: "missed", plannedStart: "2026-02-02", catchUp: false },
      { id: null, status: "missed", plannedStart: "2026-02-09", catchUp: true, originalStart: "2026-02-02" },
    ]);
    expect(overview.next).toMatchObject({
      plannedStart: "2026-02-16",
      catchUp: true,
      originalStart: "2026-02-02",
      late: true,
    });

    // Fait le 18 : la suivante part de son début réel plus la fréquence.
    const done = campaignOverview(
      input({
        campaigns: [...campaigns, { id: "c2", plannedStart: "2026-02-16", originalStart: "2026-02-02" }],
        measurements: [measure("c2", 1, "morning", paris("2026-02-18T07:00"))],
        now: paris("2026-02-25T08:00"),
      }),
    );
    expect(done.campaigns.map((view) => [view.plannedStart, view.status])).toEqual([
      ["2026-02-02", "missed"],
      ["2026-02-16", "incomplete"],
    ]);
    expect(done.next).toMatchObject({ plannedStart: "2026-05-18", catchUp: false });
  });

  it("le statut « manquée » enregistré donne la même vue que le calcul, sans le worker", () => {
    const now = paris("2026-02-17T08:00");
    const computed = input({ campaigns, now });
    expect(missedCampaignsToRecord(computed)).toEqual([
      { campaignId: "c1", plannedStart: "2026-02-02", originalStart: null },
      { campaignId: null, plannedStart: "2026-02-09", originalStart: "2026-02-02" },
    ]);
    const recorded = input({
      campaigns: [
        { id: "c1", plannedStart: "2026-02-02", status: "missed" },
        { id: "c2", plannedStart: "2026-02-09", originalStart: "2026-02-02", status: "missed" },
      ],
      now,
    });
    expect(missedCampaignsToRecord(recorded)).toEqual([]);
    const withoutIds = (overview: ReturnType<typeof campaignOverview>) => ({
      ...overview,
      campaigns: overview.campaigns.map((view) => ({ ...view, id: null })),
    });
    expect(withoutIds(campaignOverview(recorded))).toEqual(withoutIds(campaignOverview(computed)));
  });

  it("une saisie a posteriori datée de la fenêtre d'une campagne manquée la commence et abandonne ses rattrapages", () => {
    const stored = input({
      campaigns: [
        { id: "c1", plannedStart: "2026-02-02", status: "missed" },
        { id: "c2", plannedStart: "2026-02-09", originalStart: "2026-02-02", status: "missed" },
      ],
      now: paris("2026-02-20T08:00"),
    });
    // Un carnet papier recopié le 20 : mesures du 3 février.
    expect(attachMeasurement(stored, paris("2026-02-03T07:00"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
      day: 1,
      dropCatchUps: ["c2"],
      renumber: [],
    });
    // Datée de la fenêtre du rattrapage enregistré du 9 : elle le commence.
    expect(attachMeasurement(stored, paris("2026-02-10T07:00"))).toEqual({
      kind: "campaign",
      campaignId: "c2",
      day: 1,
      dropCatchUps: [],
      renumber: [],
    });
    // Datée du rattrapage calculé du 16 : il est créé.
    expect(attachMeasurement(stored, paris("2026-02-17T07:00"))).toEqual({
      kind: "newCampaign",
      plannedStart: "2026-02-16",
      originalStart: "2026-02-02",
      day: 1,
      dropCatchUps: [],
    });

    // Une fois commencée, la campagne n'est plus manquée.
    const revived = campaignOverview({
      ...stored,
      campaigns: [{ id: "c1", plannedStart: "2026-02-02", status: "missed" }],
      measurements: [measure("c1", 1, "morning", paris("2026-02-03T07:00"))],
    });
    expect(revived.campaigns.map((view) => [view.id, view.status])).toEqual([["c1", "incomplete"]]);
    expect(revived.next).toMatchObject({ plannedStart: "2026-05-03", catchUp: false });
  });

  it("une saisie datée d'une campagne manquée antérieure à une campagne commencée reste libre", () => {
    const later = input({
      campaigns: [
        { id: "c1", plannedStart: "2026-02-02", status: "missed" },
        { id: "c2", plannedStart: "2026-02-09", originalStart: "2026-02-02" },
      ],
      measurements: [measure("c2", 1, "morning", paris("2026-02-09T07:00"))],
      now: paris("2026-02-20T08:00"),
    });
    expect(attachMeasurement(later, paris("2026-02-03T07:00"))).toEqual({ kind: "free" });
  });
});

describe("sauter une campagne", () => {
  it("une campagne en retard peut être sautée ; la suivante part de sa date prévue plus la fréquence", () => {
    const late = input({ campaigns: [{ id: "c1", plannedStart: "2026-02-02" }], now: paris("2026-02-04T10:00") });
    expect(skipCampaign(late)).toEqual({ kind: "update", campaignId: "c1" });

    const skipped = campaignOverview({
      ...late,
      campaigns: [{ id: "c1", plannedStart: "2026-02-02", status: "skipped", skippedOn: "2026-02-04" }],
    });
    expect(skipped.campaigns).toMatchObject([{ id: "c1", status: "skipped", skippedOn: "2026-02-04" }]);
    expect(skipped.next).toMatchObject({ campaignId: null, plannedStart: "2026-05-02", catchUp: false, late: false });
    expect(skipped.todaySlots).toBeNull();
  });

  it("un rattrapage sauté : la suivante part de la date prévue initiale, ou du jour du saut si elle est passée", () => {
    const missed = { id: "c1", plannedStart: "2026-02-02", status: "missed" as const };
    const catchUp = input({ campaigns: [missed], frequencyMonths: 1, now: paris("2026-02-11T10:00") });
    expect(skipCampaign(catchUp)).toEqual({ kind: "create", plannedStart: "2026-02-09", originalStart: "2026-02-02" });
    const nextAfterSkipOn = (date: string) =>
      campaignOverview(
        input({
          campaigns: [
            missed,
            { id: "c2", plannedStart: "2026-02-09", originalStart: "2026-02-02", status: "skipped", skippedOn: date },
          ],
          frequencyMonths: 1,
          now: paris(`${date}T10:00`),
        }),
      ).next;
    // 2 février + 1 mois = 2 mars, pas encore passé le 11 février.
    expect(nextAfterSkipOn("2026-02-11")).toMatchObject({ plannedStart: "2026-03-02", catchUp: false });
    // Sauté le 5 mars : le 2 mars est passé, la suivante part du 5 mars plus 1 mois.
    expect(nextAfterSkipOn("2026-03-05")).toMatchObject({ plannedStart: "2026-04-05", catchUp: false });
  });

  it("une campagne à venir qui n'est pas un rattrapage, ou une campagne commencée, ne se saute pas", () => {
    expect(skipCampaign(input({}))).toEqual({ kind: "error", reason: "notSkippable" });
    expect(skipCampaign(input({ campaigns: [{ id: "c1", plannedStart: "2026-02-10" }] }))).toEqual({
      kind: "error",
      reason: "notSkippable",
    });
    const running = input({
      campaigns: [{ id: "c1", plannedStart: "2026-01-31" }],
      measurements: [measure("c1", 1, "morning", paris("2026-01-31T07:00"))],
    });
    expect(skipCampaign(running)).toEqual({ kind: "error", reason: "notSkippable" });
  });

  it("une saisie datée d'une campagne sautée reste libre", () => {
    const skipped = input({
      campaigns: [{ id: "c1", plannedStart: "2026-02-02", status: "skipped", skippedOn: "2026-02-03" }],
      now: paris("2026-02-04T10:00"),
    });
    expect(attachMeasurement(skipped, paris("2026-02-04T07:00"))).toEqual({ kind: "free" });
  });

  it("reporter un rattrapage le garde comme rattrapage", () => {
    const catchUp = input({ campaigns: [{ id: "c1", plannedStart: "2026-02-02" }], now: paris("2026-02-11T10:00") });
    expect(scheduleCampaign(catchUp, "2026-02-20")).toEqual({ kind: "create", originalStart: "2026-02-02" });
  });
});

describe("carnet recopié dans le désordre (saisie a posteriori)", () => {
  const campaigns = [{ id: "c1", plannedStart: "2026-02-02" }];

  it("une mesure antérieure au début réel, dans la fenêtre de début, avance le début et renumérote les jours", () => {
    const morning = measure("c1", 1, "morning", paris("2026-02-04T07:00"));
    const evening = measure("c1", 1, "evening", paris("2026-02-04T21:00"));
    const started = input({ campaigns, measurements: [morning, evening], now: paris("2026-02-20T10:00") });

    expect(attachMeasurement(started, paris("2026-02-02T07:00"))).toEqual({
      kind: "campaign",
      campaignId: "c1",
      day: 1,
      dropCatchUps: [],
      renumber: [
        { id: morning.id, day: 3 },
        { id: evening.id, day: 3 },
      ],
    });
    expect(attachMeasurement(started, paris("2026-02-03T21:00"))).toMatchObject({
      day: 1,
      renumber: [
        { id: morning.id, day: 2 },
        { id: evening.id, day: 2 },
      ],
    });
  });

  it("si les 3 jours ne couvriraient plus les mesures, ou hors de la fenêtre de début, elle reste libre", () => {
    const started = input({
      campaigns,
      measurements: [
        measure("c1", 1, "morning", paris("2026-02-04T07:00")),
        measure("c1", 3, "evening", paris("2026-02-06T21:00")),
      ],
      now: paris("2026-02-20T10:00"),
    });
    // Le 3 en J1 mettrait le 6 en J4.
    expect(attachMeasurement(started, paris("2026-02-03T07:00"))).toEqual({ kind: "free" });
    // La veille de la date prévue n'est pas dans la fenêtre de début.
    const early = input({
      campaigns,
      measurements: [measure("c1", 1, "morning", paris("2026-02-02T07:00"))],
      now: paris("2026-02-20T10:00"),
    });
    expect(attachMeasurement(early, paris("2026-02-01T21:00"))).toEqual({ kind: "free" });
  });

  /**
   * Recopie `entries` une à une, comme le serveur : chaque saisie est rattachée selon le domaine,
   * puis les renumérotations, créations et suppressions qu'il demande sont appliquées.
   */
  function copyNotebook(base: CampaignInput, entries: { takenAt: Date; moment: Moment }[]) {
    let state = base;
    let free: Date[] = [];
    for (const [index, { takenAt, moment }] of entries.entries()) {
      const attachment = attachMeasurement(state, takenAt);
      if (attachment.kind === "free") {
        free = [...free, takenAt];
        continue;
      }
      let { campaigns, measurements } = state;
      let campaignId: string;
      if (attachment.kind === "newCampaign") {
        campaignId = `new-${attachment.plannedStart}`;
        campaigns = [
          ...campaigns,
          { id: campaignId, plannedStart: attachment.plannedStart, originalStart: attachment.originalStart },
        ];
      } else {
        campaignId = attachment.campaignId;
        const renumbered = new Map(attachment.renumber.map(({ id, day }) => [id, day]));
        measurements = measurements.map((m) => (renumbered.has(m.id) ? { ...m, campaignDay: renumbered.get(m.id)! } : m));
      }
      campaigns = campaigns.filter((campaign) => !attachment.dropCatchUps.includes(campaign.id));
      const entry = { ...measure(campaignId, attachment.day, moment, takenAt), id: `e${index}` };
      state = { ...state, campaigns, measurements: [...measurements, entry] };
    }
    const overview = campaignOverview(state);
    return {
      slots: state.measurements.map((m) => `${m.takenAt.toISOString()} ${m.campaignId} J${m.campaignDay}`).sort(),
      free: free.map((date) => date.toISOString()).sort(),
      campaigns: overview.campaigns.map((view) => [view.actualStart, view.status, view.completeness]),
    };
  }

  function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    return items.flatMap((item, i) =>
      permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
    );
  }

  // Jours du carnet, en décalage de la date prévue (2 février) : tous dans la fenêtre de début
  // (J+0 à J+6) et sur au plus 3 jours, un créneau du matin et un du soir chacun.
  it.each([[[0, 1, 2]], [[2, 3, 4]], [[4, 5, 6]], [[1, 3]], [[5, 6]], [[0, 2]], [[3]]])(
    "le résultat ne dépend pas de l'ordre de saisie (jours %j)",
    (offsets) => {
      const entries = offsets.flatMap((offset) => [
        { takenAt: paris(`2026-02-0${2 + offset}T07:00`), moment: "morning" as const },
        { takenAt: paris(`2026-02-0${2 + offset}T21:00`), moment: "evening" as const },
      ]);
      for (const now of [paris("2026-02-08T22:00"), paris("2026-03-01T10:00")]) {
        const base = input({ campaigns, now });
        const inOrder = copyNotebook(base, entries);
        // Dans l'ordre : le premier jour du carnet est J1 et rien n'est libre.
        expect(inOrder.free).toEqual([]);
        expect(inOrder.campaigns[0]?.[0]).toBe(`2026-02-0${2 + offsets[0]!}`);
        for (const order of permutations(entries)) {
          expect(copyNotebook(base, order)).toEqual(inOrder);
        }
      }
    },
  );
});
