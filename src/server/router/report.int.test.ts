import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

const slot = (systolic: number, diastolic: number) => ({ systolic, diastolic, pulse: 70 });

describe("compte rendu", () => {
  let api: TestApi;
  let admin: Headers;

  /** Un utilisateur neuf à Paris. */
  async function newUser(name: string): Promise<Headers> {
    const email = `${name.toLowerCase()}@example.org`;
    await api.as(admin).admin.createUser({ email, name, password: `${name.toLowerCase()}-password` });
    const headers = await api.signIn(email, `${name.toLowerCase()}-password`);
    await api.as(headers).settings.update({ timeZone: "Europe/Paris" });
    return headers;
  }

  /** Planifie une campagne au jour `start` et la commence par 3 mesures à `systolic`/`diastolic` (3/18). */
  async function campaignOn(headers: Headers, start: string, systolic: number, diastolic: number) {
    const at = (instant: string) => api.as(headers, { now: new Date(instant) });
    await at(`${start}T06:00:00+01:00`).campaigns.schedule({ start });
    await at(`${start}T08:00:00+01:00`).measurements.create({
      takenAt: new Date(`${start}T07:30:00+01:00`),
      moment: "morning",
      measurements: [slot(systolic, diastolic), slot(systolic, diastolic), slot(systolic, diastolic)],
    });
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    admin = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("chaque période sélectionne ses campagnes terminées, bornes comprises, sans mesure libre ni campagne en cours", async () => {
    const alice = await newUser("Alice");
    await campaignOn(alice, "2020-01-10", 150, 95); // plus de 5 ans
    await campaignOn(alice, "2022-02-10", 145, 92); // pile 5 ans
    await campaignOn(alice, "2026-02-10", 136, 86); // pile un an
    await campaignOn(alice, "2026-11-20", 130, 80);
    // Une mesure libre très élevée, hors campagne.
    await api.as(alice, { now: new Date("2026-12-20T12:00:00+01:00") }).measurements.create({
      takenAt: new Date("2026-12-20T12:00:00+01:00"),
      moment: "evening",
      measurements: [slot(190, 120)],
    });
    // La campagne en cours aujourd'hui (10 février 2027) n'est pas encore au compte rendu.
    await campaignOn(alice, "2027-02-10", 170, 100);

    const report = (period: "lastCampaign" | "oneYear" | "fiveYears" | "all", today = "2027-02-10") =>
      api.as(alice, { now: new Date(`${today}T12:00:00+01:00`) }).report.get({ period });
    const starts = async (...args: Parameters<typeof report>) =>
      (await report(...args)).campaigns.map((entry) => entry.campaign.actualStart);

    await expect(starts("lastCampaign")).resolves.toEqual(["2026-11-20"]);
    // Le 10 février 2027 : un an et cinq ans jour pour jour, bornes comprises.
    await expect(starts("oneYear")).resolves.toEqual(["2026-02-10", "2026-11-20"]);
    await expect(starts("fiveYears")).resolves.toEqual(["2022-02-10", "2026-02-10", "2026-11-20"]);
    await expect(starts("all")).resolves.toEqual(["2020-01-10", "2022-02-10", "2026-02-10", "2026-11-20"]);
    // Le lendemain, ces campagnes sortent de leur période.
    await expect(starts("oneYear", "2027-02-11")).resolves.toEqual(["2026-11-20"]);
    await expect(starts("fiveYears", "2027-02-11")).resolves.toEqual(["2026-02-10", "2026-11-20"]);

    const oneYear = await report("oneYear");
    expect(oneYear).toMatchObject({ period: "oneYear", from: "2026-02-10", to: "2027-02-10" });
    // (3 × 136 + 3 × 130) / 6 = 133 ; (3 × 86 + 3 × 80) / 6 = 83 : ni la mesure libre ni la campagne en cours.
    expect(oneYear.summary).toMatchObject({
      averages: { global: { systolic: 133, diastolic: 83, count: 6 }, evening: null },
      campaignCount: 2,
      completeCount: 0,
      completeShare: 0,
    });
    // Écart avec la précédente (hors période pour la première).
    expect(oneYear.campaigns.map((entry) => entry.delta)).toEqual([
      { systolic: -9, diastolic: -6 },
      { systolic: -6, diastolic: -6 },
    ]);
    // Incomplète : 3/18, il manque 5 créneaux.
    expect(oneYear.campaigns[1]).toMatchObject({ complete: false, campaign: { completeness: 3, status: "incomplete" } });
    expect(oneYear.campaigns[1]?.campaign.missingSlots).toHaveLength(5);
  });

  it("ne montre que les campagnes de l'appelant", async () => {
    const bob = await newUser("Bob");
    const carol = await newUser("Carol");
    await campaignOn(bob, "2026-01-05", 128, 82);
    const now = { now: new Date("2026-02-01T12:00:00+01:00") };
    expect((await api.as(bob, now).report.get({ period: "all" })).campaigns).toHaveLength(1);
    expect((await api.as(carol, now).report.get({ period: "all" })).campaigns).toEqual([]);
  });

  it("refuse une période inconnue et un appelant anonyme", async () => {
    const dave = await newUser("Dave");
    await expect(api.as(dave).report.get({ period: "tenYears" as "all" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.client.report.get({ period: "all" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
