import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campaignOverview } from "@/domain/campaign";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import { campaign, measurement, user } from "@/server/db/schema";
import { createTestApi, type TestApi } from "@/server/testing/test-api";
import { runMissedCampaigns } from "./missed-campaigns";

/** Un instant à une heure locale de Paris (hiver, UTC+1). */
const paris = (local: string) => new Date(`${local}:00+01:00`);

describe("tâche du worker : campagnes manquées (ADR-0011)", () => {
  let api: TestApi;

  /** Un utilisateur neuf (Paris par défaut) dont la première campagne est prévue le 2 février 2026. */
  async function plannedUser() {
    const id = `user-${randomUUID()}`;
    await api.db.insert(user).values({ id, name: id, email: `${id}@example.org` });
    const [created] = await api.db
      .insert(campaign)
      .values({ userId: id, plannedStart: "2026-02-02" })
      .returning({ id: campaign.id });
    return { id, campaignId: created!.id };
  }

  const stored = (userId: string) =>
    api.db
      .select({ plannedStart: campaign.plannedStart, status: campaign.status, originalStart: campaign.originalStart })
      .from(campaign)
      .where(eq(campaign.userId, userId))
      .orderBy(campaign.plannedStart);

  /** La vue du domaine, sans les identifiants (une campagne calculée n'en a pas encore). */
  const view = async (userId: string, now: Date) => {
    const overview = campaignOverview(await loadCampaignInput(api.db, userId, now));
    return { ...overview, campaigns: overview.campaigns.map((c) => ({ ...c, id: null })) };
  };

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("enregistre les campagnes manquées, rattrapages compris, sans changer ce que voit l'utilisateur", async () => {
    const alice = await plannedUser();
    const now = paris("2026-02-17T03:00");
    const before = await view(alice.id, now);

    await runMissedCampaigns({ db: api.db, now });
    expect(await stored(alice.id)).toEqual([
      { plannedStart: "2026-02-02", status: "missed", originalStart: null },
      { plannedStart: "2026-02-09", status: "missed", originalStart: "2026-02-02" },
    ]);
    expect(await view(alice.id, now)).toEqual(before);
  });

  it("est idempotente, même lancée deux fois en même temps", async () => {
    const bob = await plannedUser();
    const now = paris("2026-02-17T03:00");
    await Promise.all([runMissedCampaigns({ db: api.db, now }), runMissedCampaigns({ db: api.db, now })]);
    await runMissedCampaigns({ db: api.db, now });
    expect(await stored(bob.id)).toHaveLength(2);
  });

  it("ne touche ni une campagne commencée, ni une campagne encore dans sa fenêtre de début", async () => {
    const carol = await plannedUser();
    await api.db.insert(measurement).values({
      userId: carol.id,
      takenAt: paris("2026-02-03T07:00"),
      systolic: 130,
      diastolic: 80,
      pulse: 70,
      moment: "morning",
      campaignId: carol.campaignId,
      campaignDay: 1,
    });
    const dan = await plannedUser();
    await runMissedCampaigns({ db: api.db, now: paris("2026-02-08T23:00") });
    expect(await stored(carol.id)).toEqual([{ plannedStart: "2026-02-02", status: null, originalStart: null }]);
    expect(await stored(dan.id)).toEqual([{ plannedStart: "2026-02-02", status: null, originalStart: null }]);
  });
});
