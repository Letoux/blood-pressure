import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

/** Réglages d'un utilisateur qui n'a rien réglé (hors nom). */
const defaults = {
  locale: null,
  theme: "system",
  timeZone: null,
  frequencyMonths: 3,
  morningTime: "07:30",
  eveningTime: "21:00",
  dayBeforeReminder: true,
  followUpEnabled: false,
  followUpDelayMinutes: 30,
  onboarded: false,
  guideline: "sfhta",
};

describe("settings", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("sans réglage enregistré : nom du compte, langue du navigateur, thème système", async () => {
    const alice = await api.newUser("Alice");
    await expect(api.as(alice.headers).settings.get()).resolves.toEqual({ name: "Alice", ...defaults });
  });

  it("enregistre le nom affiché, la langue et le thème, et les relit à la session suivante", async () => {
    const alice = await api.newUser("Alice");
    const expected = { ...defaults, name: "Alice D.", locale: "en", theme: "dark" };
    await expect(
      api.as(alice.headers).settings.update({ name: "  Alice D.  ", locale: "en", theme: "dark" }),
    ).resolves.toEqual(expected);

    const nextSession = await api.signIn(alice.email, alice.password);
    await expect(api.as(nextSession).settings.get()).resolves.toEqual(expected);
    await expect(api.as(nextSession).me()).resolves.toMatchObject({ name: "Alice D." });
  });

  it("une mise à jour partielle ne touche pas aux autres réglages", async () => {
    const alice = await api.newUser("Alice");
    await api.as(alice.headers).settings.update({ locale: "en", frequencyMonths: 6, morningTime: "06:45" });
    await expect(api.as(alice.headers).settings.update({ theme: "light" })).resolves.toEqual({
      ...defaults,
      name: "Alice",
      locale: "en",
      theme: "light",
      frequencyMonths: 6,
      morningTime: "06:45",
    });
  });

  it("enregistre le fuseau (IANA) et la fréquence des campagnes (1 à 12 mois)", async () => {
    const alice = await api.newUser("Alice");
    await expect(
      api.as(alice.headers).settings.update({ timeZone: "America/New_York", frequencyMonths: 6 }),
    ).resolves.toMatchObject({ timeZone: "America/New_York", frequencyMonths: 6 });
  });

  it("enregistre le référentiel choisi (SFHTA par défaut)", async () => {
    const alice = await api.newUser("Alice");
    await expect(api.as(alice.headers).settings.update({ guideline: "accAha2017" })).resolves.toMatchObject({
      guideline: "accAha2017",
    });
    await expect(api.as(alice.headers).settings.get()).resolves.toMatchObject({ guideline: "accAha2017" });
  });

  it("les réglages d'un utilisateur n'affectent pas ceux d'un autre", async () => {
    const alice = await api.newUser("Alice");
    const bob = await api.newUser("Bob");
    await api.as(alice.headers).settings.update({ theme: "dark", onboarded: true, guideline: "accAha2017" });
    await expect(api.as(bob.headers).settings.get()).resolves.toEqual({ name: "Bob", ...defaults });
  });

  it("enregistre les préférences de rappel : heures, rappel la veille, relance et son délai", async () => {
    const alice = await api.newUser("Alice");
    const reminders = {
      morningTime: "06:45",
      eveningTime: "22:15",
      dayBeforeReminder: false,
      followUpEnabled: true,
      followUpDelayMinutes: 60,
    };
    await expect(api.as(alice.headers).settings.update(reminders)).resolves.toMatchObject(reminders);
    await expect(api.as(alice.headers).settings.get()).resolves.toMatchObject(reminders);
  });

  it("retient que le premier lancement a été vu", async () => {
    const alice = await api.newUser("Alice");
    await expect(api.as(alice.headers).settings.update({ onboarded: true })).resolves.toMatchObject({ onboarded: true });
    await expect(api.as(alice.headers).settings.get()).resolves.toMatchObject({ onboarded: true });
  });

  it.each([
    ["un nom vide", { name: "   " }],
    ["une langue inconnue", { locale: "de" }],
    ["un thème inconnu", { theme: "sepia" }],
    ["un fuseau inconnu", { timeZone: "Mars/Olympus" }],
    ["une fréquence de 0 mois", { frequencyMonths: 0 }],
    ["une fréquence de 13 mois", { frequencyMonths: 13 }],
    ["une heure du matin hors bornes", { morningTime: "24:00" }],
    ["une heure du soir mal écrite", { eveningTime: "7:30" }],
    ["un délai de relance trop court", { followUpDelayMinutes: 5 }],
    ["un délai de relance trop long", { followUpDelayMinutes: 241 }],
    ["un délai de relance non entier", { followUpDelayMinutes: 30.5 }],
    ["un référentiel inconnu", { guideline: "france" }],
  ])("refuse %s", async (_label, input) => {
    const bob = await api.newUser("Bob");
    await expect(
      // @ts-expect-error valeurs invalides envoyées volontairement
      api.as(bob.headers).settings.update(input),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(api.client.settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.client.settings.update({ theme: "dark" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
