import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

const slot = (systolic: number, diastolic = 80) => ({ systolic, diastolic, pulse: 70 });

describe("campagnes", () => {
  let api: TestApi;
  let admin: Headers;

  /** Un utilisateur neuf à Paris, avec la fréquence par défaut. */
  async function newUser(name: string): Promise<Headers> {
    const email = `${name.toLowerCase()}@example.org`;
    await api.as(admin).admin.createUser({ email, name, password: `${name.toLowerCase()}-password` });
    const headers = await api.signIn(email, `${name.toLowerCase()}-password`);
    await api.as(headers).settings.update({ timeZone: "Europe/Paris" });
    return headers;
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    admin = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("planifie la première campagne, puis rattache les saisies à leur créneau", async () => {
    const alice = await newUser("Alice");
    const at = (now: string) => api.as(alice, { now: new Date(now) });

    await expect(at("2026-02-01T10:00:00+01:00").campaigns.overview()).resolves.toMatchObject({
      campaigns: [],
      next: null,
    });
    const planned = await at("2026-02-01T10:00:00+01:00").campaigns.schedule({ start: "2026-02-02" });
    expect(planned.next).toMatchObject({ plannedStart: "2026-02-02" });
    const campaignId = planned.next?.campaignId;
    expect(campaignId).toEqual(expect.any(String));

    // Avant la période prévue : mesure libre.
    const [free] = await at("2026-02-01T21:00:00+01:00").measurements.create({
      takenAt: new Date("2026-02-01T21:00:00+01:00"),
      moment: "evening",
      measurements: [slot(125)],
    });
    expect(free).toMatchObject({ campaignId: null, campaignDay: null });

    // Le 3 février (un jour après la date prévue) : la campagne commence, J1 matin.
    const j1 = await at("2026-02-03T07:10:00+01:00").measurements.create({
      takenAt: new Date("2026-02-03T07:00:00+01:00"),
      moment: "morning",
      measurements: [slot(140), slot(130), slot(120)],
    });
    expect(j1.map((m) => [m.campaignId, m.campaignDay])).toEqual([
      [campaignId, 1],
      [campaignId, 1],
      [campaignId, 1],
    ]);
    const [j2] = await at("2026-02-04T21:00:00+01:00").measurements.create({
      takenAt: new Date("2026-02-04T21:00:00+01:00"),
      moment: "evening",
      measurements: [slot(150, 90)],
    });
    expect(j2).toMatchObject({ campaignId, campaignDay: 2, moment: "evening" });

    const running = await at("2026-02-04T21:05:00+01:00").campaigns.overview();
    expect(running.current).toMatchObject({
      id: campaignId,
      status: "inProgress",
      actualStart: "2026-02-03",
      completeness: 4,
    });
    expect(running.todaySlots?.slots).toMatchObject([
      { day: 2, moment: "morning", filled: false },
      { day: 2, moment: "evening", count: 1, filled: true },
    ]);

    // Terminée, incomplète : 4/18, moyenne sur les 4 mesures présentes, mesure libre exclue.
    const done = await at("2026-02-06T08:00:00+01:00").campaigns.overview();
    expect(done.campaigns).toMatchObject([
      {
        id: campaignId,
        status: "incomplete",
        completeness: 4,
        averages: { global: { systolic: 135, diastolic: 82.5, count: 4 } },
      },
    ]);
    expect(done.campaigns[0]?.missingSlots).toHaveLength(4);
    expect(done.next).toEqual({ campaignId: null, plannedStart: "2026-05-03" });
  });

  it("la fréquence des réglages fixe la prochaine campagne, qu'on peut avancer ou reporter", async () => {
    const bob = await newUser("Bob");
    const at = (now: string) => api.as(bob, { now: new Date(now) });
    await at("2026-02-01T10:00:00+01:00").campaigns.schedule({ start: "2026-02-01" });
    await at("2026-02-01T08:00:00+01:00").measurements.create({
      takenAt: new Date("2026-02-01T08:00:00+01:00"),
      moment: "morning",
      measurements: [slot(130)],
    });
    await api.as(bob).settings.update({ frequencyMonths: 1 });
    const overview = await at("2026-02-10T10:00:00+01:00").campaigns.overview();
    expect(overview.next).toEqual({ campaignId: null, plannedStart: "2026-03-01" });

    // Reporter la prochaine campagne calculée l'enregistre à la date choisie.
    const moved = await at("2026-02-10T10:00:00+01:00").campaigns.schedule({ start: "2026-03-10" });
    expect(moved.next).toEqual({ campaignId: expect.any(String), plannedStart: "2026-03-10" });
    // L'avancer ensuite déplace la même campagne.
    const advanced = await at("2026-02-10T10:00:00+01:00").campaigns.schedule({ start: "2026-02-20" });
    expect(advanced.next).toEqual({ campaignId: moved.next?.campaignId, plannedStart: "2026-02-20" });
    expect(advanced.campaigns).toHaveLength(2);

    // Pas dans le passé.
    await expect(at("2026-02-10T10:00:00+01:00").campaigns.schedule({ start: "2026-02-09" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(at("2026-02-10T10:00:00+01:00").campaigns.schedule({ start: "2026-02-31" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("une saisie pendant la prochaine campagne calculée l'enregistre et s'y rattache", async () => {
    const carol = await newUser("Carol");
    const at = (now: string) => api.as(carol, { now: new Date(now) });
    await at("2026-02-01T10:00:00+01:00").campaigns.schedule({ start: "2026-02-01" });
    await at("2026-02-01T10:00:00+01:00").measurements.create({
      takenAt: new Date("2026-02-01T08:00:00+01:00"),
      moment: "morning",
      measurements: [slot(130)],
    });
    const [measured] = await at("2026-05-02T08:00:00+02:00").measurements.create({
      takenAt: new Date("2026-05-02T08:00:00+02:00"),
      moment: "morning",
      measurements: [slot(128)],
    });
    expect(measured).toMatchObject({ campaignDay: 1, campaignId: expect.any(String) });
    const overview = await at("2026-05-02T09:00:00+02:00").campaigns.overview();
    expect(overview.current).toMatchObject({ id: measured?.campaignId, plannedStart: "2026-05-01", actualStart: "2026-05-02" });
  });

  it("modifier l'horodatage d'une mesure la rattache au nouveau créneau, ou en fait une mesure libre", async () => {
    const dan = await newUser("Dan");
    const at = (now: string) => api.as(dan, { now: new Date(now) });
    await at("2026-02-01T10:00:00+01:00").campaigns.schedule({ start: "2026-02-02" });
    const [first, second] = await at("2026-02-02T08:00:00+01:00").measurements.create({
      takenAt: new Date("2026-02-02T08:00:00+01:00"),
      moment: "morning",
      measurements: [slot(130), slot(131)],
    });
    if (!first || !second) throw new Error("mesures non créées");
    const edit = { systolic: 130, diastolic: 80, pulse: 70, moment: "evening" as const };
    await expect(
      at("2026-02-03T22:00:00+01:00").measurements.update({
        id: first.id,
        takenAt: new Date("2026-02-03T21:00:00+01:00"),
        ...edit,
      }),
    ).resolves.toMatchObject({ campaignId: first.campaignId, campaignDay: 2, moment: "evening" });
    await expect(
      at("2026-02-03T22:00:00+01:00").measurements.update({
        id: first.id,
        takenAt: new Date("2026-01-20T21:00:00+01:00"),
        ...edit,
      }),
    ).resolves.toMatchObject({ campaignId: null, campaignDay: null });
  });

  it("supprimer une campagne supprime ses mesures, pas les mesures libres", async () => {
    const eve = await newUser("Eve");
    const at = (now: string) => api.as(eve, { now: new Date(now) });
    const { next } = await at("2026-02-02T07:00:00+01:00").campaigns.schedule({ start: "2026-02-02" });
    await at("2026-02-02T08:00:00+01:00").measurements.create({
      takenAt: new Date("2026-02-02T08:00:00+01:00"),
      moment: "morning",
      measurements: [slot(130), slot(131)],
    });
    await at("2026-02-02T08:00:00+01:00").measurements.create({
      takenAt: new Date("2026-01-02T08:00:00+01:00"),
      moment: "morning",
      measurements: [slot(132)],
    });
    await at("2026-02-02T09:00:00+01:00").campaigns.delete({ id: next?.campaignId ?? "" });
    const left = await api.as(eve).measurements.list();
    expect(left).toEqual([expect.objectContaining({ systolic: 132, campaignId: null })]);
    await expect(at("2026-02-02T09:00:00+01:00").campaigns.overview()).resolves.toMatchObject({
      campaigns: [],
      next: null,
    });
  });

  it("un utilisateur ne voit ni ne supprime les campagnes d'un autre", async () => {
    const frank = await newUser("Frank");
    const grace = await newUser("Grace");
    const now = { now: new Date("2026-02-01T10:00:00+01:00") };
    const { next } = await api.as(frank, now).campaigns.schedule({ start: "2026-02-05" });
    await expect(api.as(grace, now).campaigns.overview()).resolves.toMatchObject({ campaigns: [], next: null });
    await expect(api.as(grace).campaigns.delete({ id: next?.campaignId ?? "" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(api.as(frank, now).campaigns.overview()).resolves.toMatchObject({ campaigns: [{ id: next?.campaignId }] });
  });
});
