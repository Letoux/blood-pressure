import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

type Measurement = Awaited<ReturnType<TestApi["client"]["measurements"]["list"]>>[number];

function first<T>(items: T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error("liste vide");
  return item;
}

/** Les champs modifiables d'une mesure, tels que `measurements.update` les attend. */
const editable = ({ id, takenAt, moment, systolic, diastolic, pulse }: Measurement) => ({
  id,
  takenAt,
  moment,
  systolic,
  diastolic,
  pulse,
});

describe("mesures", () => {
  let api: TestApi;

  const morning = new Date("2026-10-30T06:30:00Z");
  const evening = new Date("2026-10-30T20:15:00Z");

  /** Les en-têtes de session d'un utilisateur neuf, propre au test. */
  const newUser = async (name: string) => (await api.newUser(name)).headers;

  /** Un utilisateur neuf avec une mesure libre. */
  async function aliceWithMeasurement() {
    const alice = await newUser("Alice");
    await api.as(alice).measurements.create({
      takenAt: morning,
      moment: "morning",
      measurements: [{ systolic: 131, diastolic: 84, pulse: 72 }],
    });
    return alice;
  }

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("enregistre 1 à 3 mesures d'un créneau comme mesures libres, et les liste de la plus récente à la plus ancienne", async () => {
    const alice = await newUser("Alice");
    await api.as(alice).measurements.create({
      takenAt: morning,
      moment: "morning",
      comment: "  Après le café  ",
      measurements: [
        { systolic: 131, diastolic: 84, pulse: 72 },
        { systolic: 128, diastolic: 82, pulse: 70 },
      ],
    });
    await api.as(alice).measurements.create({
      takenAt: evening,
      moment: "evening",
      measurements: [{ systolic: 185, diastolic: 95, pulse: 80 }],
    });

    const list = await api.as(alice).measurements.list();
    expect(list).toEqual([
      expect.objectContaining({ takenAt: evening, moment: "evening", systolic: 185, comment: null }),
      expect.objectContaining({ takenAt: morning, moment: "morning", comment: "Après le café" }),
      expect.objectContaining({ takenAt: morning, moment: "morning", comment: "Après le café" }),
    ]);
    expect(list.slice(1).map(({ systolic }) => systolic).sort()).toEqual([128, 131]);
    for (const measurement of list) {
      expect(measurement).toMatchObject({ campaignId: null, campaignDay: null });
    }
  });

  it("enregistre une valeur d'alerte (180/110) : l'avertissement ne bloque pas", async () => {
    const bob = await newUser("Bob");
    const saved = first(
      await api.as(bob).measurements.create({
        takenAt: morning,
        moment: "morning",
        measurements: [{ systolic: 180, diastolic: 110, pulse: 90 }],
      }),
    );
    expect(saved).toMatchObject({ systolic: 180, diastolic: 110, pulse: 90 });
    await api.as(bob).measurements.delete({ id: saved.id });
  });

  it("refuse une mesure invalide selon le domaine, ou un nombre de mesures hors de 1 à 3", async () => {
    const bob = await newUser("Bob");
    const valid = { systolic: 120, diastolic: 80, pulse: 70 };
    const invalid = [
      [{ ...valid, systolic: 261 }],
      [{ ...valid, diastolic: 29 }],
      [{ ...valid, pulse: 221 }],
      [{ ...valid, systolic: 80, diastolic: 80 }],
      [],
      [valid, valid, valid, valid],
    ];
    for (const measurements of invalid) {
      await expect(
        api.as(bob).measurements.create({ takenAt: morning, moment: "morning", measurements }),
        JSON.stringify(measurements),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(api.as(bob).measurements.list()).resolves.toEqual([]);
  });

  it("modifie puis supprime sa propre mesure", async () => {
    const bob = await newUser("Bob");
    const created = first(
      await api.as(bob).measurements.create({
        takenAt: morning,
        moment: "morning",
        comment: "brouillon",
        measurements: [{ systolic: 140, diastolic: 90, pulse: 75 }],
      }),
    );

    const updated = await api.as(bob).measurements.update({
      id: created.id,
      takenAt: evening,
      moment: "evening",
      systolic: 138,
      diastolic: 88,
      pulse: 74,
      comment: "",
    });
    expect(updated).toEqual({
      ...created,
      takenAt: evening,
      moment: "evening",
      systolic: 138,
      diastolic: 88,
      pulse: 74,
      comment: null,
    });
    await expect(api.as(bob).measurements.list()).resolves.toEqual([updated]);

    await expect(
      api.as(bob).measurements.update({ ...editable(updated), diastolic: 138 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await api.as(bob).measurements.delete({ id: created.id });
    await expect(api.as(bob).measurements.list()).resolves.toEqual([]);
    await expect(api.as(bob).measurements.delete({ id: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("un utilisateur ne peut ni lire, ni modifier, ni supprimer les mesures d'un autre", async () => {
    const alice = await aliceWithMeasurement();
    const bob = await newUser("Bob");
    const aliceBefore = await api.as(alice).measurements.list();
    const target = first(aliceBefore);

    await expect(api.as(bob).measurements.list()).resolves.toEqual([]);
    await expect(
      api.as(bob).measurements.update({ ...editable(target), comment: "piraté", systolic: 200 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.as(bob).measurements.delete({ id: target.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(api.as(alice).measurements.list()).resolves.toEqual(aliceBefore);
  });

  it("refuse l'admin (aucun accès aux mesures, ADR-0004) et l'appelant non authentifié", async () => {
    const alice = await aliceWithMeasurement();
    const admin = await api.admin();
    const aliceBefore = await api.as(alice).measurements.list();
    const target = first(aliceBefore);
    const calls = (client: TestApi["client"]) => [
      () => client.measurements.list(),
      () =>
        client.measurements.create({
          takenAt: morning,
          moment: "morning",
          measurements: [{ systolic: 120, diastolic: 80, pulse: 70 }],
        }),
      () => client.measurements.update(editable(target)),
      () => client.measurements.delete({ id: target.id }),
    ];
    for (const call of calls(api.as(admin))) {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const call of calls(api.client)) {
      await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(api.as(alice).measurements.list()).resolves.toEqual(aliceBefore);
  });
});
