import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

/** Lignes du CSV, sans le BOM ni la dernière ligne vide. */
function csvLines(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
}

describe("export et suppression du compte", () => {
  let api: TestApi;
  let admin: Headers;

  async function createUser(name: string) {
    const email = `${name.toLowerCase()}@example.org`;
    const password = `${name.toLowerCase()}-password`;
    await api.as(admin).admin.createUser({ email, name, password });
    return { email, password, headers: await api.signIn(email, password) };
  }

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    admin = await api.signIn("admin@example.org", "admin-password");
  });

  afterAll(async () => {
    await api.close();
  });

  describe("export CSV", () => {
    it("contient toutes les mesures de l'appelant, de la plus ancienne à la plus récente, et seulement les siennes", async () => {
      const alice = await createUser("Alice");
      const bob = await createUser("Bob");
      await api.as(alice.headers).measurements.create({
        takenAt: new Date("2026-10-30T20:15:00Z"),
        moment: "evening",
        comment: "=1+1",
        measurements: [{ systolic: 141, diastolic: 91, pulse: 80 }],
      });
      await api.as(alice.headers).measurements.create({
        takenAt: new Date("2026-10-30T06:30:00Z"),
        moment: "morning",
        measurements: [
          { systolic: 131, diastolic: 84, pulse: 72 },
          { systolic: 128, diastolic: 82, pulse: 70 },
        ],
      });
      await api.as(bob.headers).measurements.create({
        takenAt: new Date("2026-10-30T07:00:00Z"),
        moment: "morning",
        measurements: [{ systolic: 177, diastolic: 99, pulse: 66 }],
      });

      await api.as(alice.headers).settings.update({ timeZone: "Europe/Paris" });
      const { filename, csv } = await api.as(alice.headers).account.exportMeasurements({ locale: "fr" });

      expect(filename).toMatch(/^tension-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(csv.startsWith("﻿")).toBe(true);
      const [header, ...rows] = csvLines(csv);
      expect(header).toBe(
        "Date,Heure,Fuseau horaire,Systolique (mmHg),Diastolique (mmHg),Pouls (bpm),Commentaire,Mesure libre,Campagne,Jour de campagne,Moment",
      );
      // Les mesures d'un même créneau ont le même horodatage : leur ordre entre elles est libre.
      expect(rows.slice(0, 2).sort()).toEqual([
        "2026-10-30,07:30,Europe/Paris,128,82,70,,oui,,,Matin",
        "2026-10-30,07:30,Europe/Paris,131,84,72,,oui,,,Matin",
      ]);
      expect(rows.slice(2)).toEqual(["2026-10-30,21:15,Europe/Paris,141,91,80,'=1+1,oui,,,Soir"]);
      expect(csv).not.toContain("177");
    });

    it("suit la langue demandée, et vaut l'en-tête seul sans mesure", async () => {
      const carol = await createUser("Carol");

      const { csv } = await api.as(carol.headers).account.exportMeasurements({ locale: "en" });

      expect(csvLines(csv)).toEqual([
        "Date,Time,Time zone,Systolic (mmHg),Diastolic (mmHg),Pulse (bpm),Comment,Free measurement,Campaign,Campaign day,Moment",
      ]);
    });

    it("donne l'heure dans le fuseau des réglages et la campagne par sa date de début", async () => {
      const dave = await createUser("Dave");
      await api.as(dave.headers).settings.update({ timeZone: "Asia/Tokyo" });
      const at = api.as(dave.headers, { now: new Date("2026-02-02T10:00:00+09:00") });
      await at.campaigns.schedule({ start: "2026-02-02" });
      await at.measurements.create({
        takenAt: new Date("2026-02-02T07:00:00+09:00"),
        moment: "morning",
        measurements: [{ systolic: 131, diastolic: 84, pulse: 72 }],
      });

      const { csv } = await at.account.exportMeasurements({ locale: "fr" });

      expect(csvLines(csv)[1]).toBe("2026-02-02,07:00,Asia/Tokyo,131,84,72,,non,2026-02-02,1,Matin");
    });

    it("est interdit à l'admin, qui n'a pas de mesures et ne peut exporter celles de personne", async () => {
      await expect(
        api.as(admin).account.exportMeasurements({ locale: "fr" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("suppression du compte", () => {
    it("avec le bon mot de passe, supprime le compte, ses mesures et toutes ses sessions", async () => {
      const erin = await createUser("Erin");
      const otherDevice = await api.signIn(erin.email, erin.password);
      await api.as(erin.headers).measurements.create({
        takenAt: new Date("2026-10-30T06:30:00Z"),
        moment: "morning",
        measurements: [{ systolic: 131, diastolic: 84, pulse: 72 }],
      });
      const frank = await createUser("Frank");
      await api.as(frank.headers).measurements.create({
        takenAt: new Date("2026-10-30T06:30:00Z"),
        moment: "morning",
        measurements: [{ systolic: 120, diastolic: 80, pulse: 60 }],
      });

      await api.as(erin.headers).account.delete({ password: erin.password });

      await expect(api.as(erin.headers).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(api.as(otherDevice).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(api.signIn(erin.email, erin.password)).rejects.toThrow();
      const users = await api.as(admin).admin.listUsers();
      expect(users.map((u) => u.email)).not.toContain(erin.email);

      // Un compte recréé avec le même email repart sans aucune mesure ; Frank garde les siennes.
      const again = await createUser("Erin");
      await expect(api.as(again.headers).measurements.list()).resolves.toEqual([]);
      await expect(api.as(frank.headers).measurements.list()).resolves.toHaveLength(1);
    });

    it("refuse un mot de passe faux, et le compte reste intact", async () => {
      const grace = await createUser("Grace");

      await expect(api.as(grace.headers).account.delete({ password: "mauvais-mdp" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(api.as(grace.headers).me()).resolves.toMatchObject({ email: grace.email });
    });

    it("est interdite à l'admin, dont le compte vient du .env", async () => {
      await expect(api.as(admin).account.delete({ password: "admin-password" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(api.signIn("admin@example.org", "admin-password")).resolves.toBeDefined();
    });

    it("refuse un appelant non authentifié", async () => {
      await expect(api.client.account.delete({ password: "peu-importe" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
