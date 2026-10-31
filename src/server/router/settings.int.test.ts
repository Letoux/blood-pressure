import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAdmin } from "@/server/auth/ensure-admin";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

/** Préférences de rappel et premier lancement d'un utilisateur qui n'a rien réglé. */
const defaultReminders = {
  morningTime: "07:30",
  eveningTime: "21:00",
  dayBeforeReminder: true,
  followUpEnabled: false,
  followUpDelayMinutes: 30,
  onboarded: false,
};

describe("settings", () => {
  let api: TestApi;
  let alice: Headers;
  let bob: Headers;

  beforeAll(async () => {
    api = await createTestApi();
    await ensureAdmin(api.auth, { email: "admin@example.org", password: "admin-password" });
    const admin = await api.signIn("admin@example.org", "admin-password");
    for (const name of ["Alice", "Bob"]) {
      await api.as(admin).admin.createUser({
        email: `${name.toLowerCase()}@example.org`,
        name,
        password: `${name.toLowerCase()}-password`,
      });
    }
    alice = await api.signIn("alice@example.org", "alice-password");
    bob = await api.signIn("bob@example.org", "bob-password");
  });

  afterAll(async () => {
    await api.close();
  });

  it("sans réglage enregistré : nom du compte, langue du navigateur, thème système", async () => {
    await expect(api.as(alice).settings.get()).resolves.toEqual({
      name: "Alice",
      locale: null,
      theme: "system",
      timeZone: null,
      frequencyMonths: 3,
      ...defaultReminders,
      guideline: "sfhta",
    });
  });

  it("enregistre le nom affiché, la langue et le thème, et les relit à la session suivante", async () => {
    await expect(
      api.as(alice).settings.update({ name: "  Alice D.  ", locale: "en", theme: "dark" }),
    ).resolves.toEqual({
      name: "Alice D.",
      locale: "en",
      theme: "dark",
      timeZone: null,
      frequencyMonths: 3,
      ...defaultReminders,
      guideline: "sfhta",
    });

    const nextSession = await api.signIn("alice@example.org", "alice-password");
    await expect(api.as(nextSession).settings.get()).resolves.toEqual({
      name: "Alice D.",
      locale: "en",
      theme: "dark",
      timeZone: null,
      frequencyMonths: 3,
      ...defaultReminders,
      guideline: "sfhta",
    });
    await expect(api.as(nextSession).me()).resolves.toMatchObject({ name: "Alice D." });
  });

  it("une mise à jour partielle ne touche pas aux autres réglages", async () => {
    await expect(api.as(alice).settings.update({ theme: "light" })).resolves.toEqual({
      name: "Alice D.",
      locale: "en",
      theme: "light",
      timeZone: null,
      frequencyMonths: 3,
      ...defaultReminders,
      guideline: "sfhta",
    });
  });

  it("enregistre le fuseau (IANA) et la fréquence des campagnes (1 à 12 mois)", async () => {
    await expect(
      api.as(alice).settings.update({ timeZone: "America/New_York", frequencyMonths: 6 }),
    ).resolves.toMatchObject({ timeZone: "America/New_York", frequencyMonths: 6, theme: "light" });
  });

  it("enregistre le référentiel choisi (SFHTA par défaut)", async () => {
    await expect(api.as(alice).settings.update({ guideline: "accAha2017" })).resolves.toMatchObject({
      guideline: "accAha2017",
      frequencyMonths: 6,
    });
    await expect(api.as(alice).settings.get()).resolves.toMatchObject({ guideline: "accAha2017" });
  });

  it("les réglages d'un utilisateur n'affectent pas ceux d'un autre", async () => {
    await expect(api.as(bob).settings.get()).resolves.toEqual({
      name: "Bob",
      locale: null,
      theme: "system",
      timeZone: null,
      frequencyMonths: 3,
      ...defaultReminders,
      guideline: "sfhta",
    });
  });

  it("enregistre les préférences de rappel : heures, rappel la veille, relance et son délai", async () => {
    await expect(
      api.as(alice).settings.update({
        morningTime: "06:45",
        eveningTime: "22:15",
        dayBeforeReminder: false,
        followUpEnabled: true,
        followUpDelayMinutes: 60,
      }),
    ).resolves.toMatchObject({
      morningTime: "06:45",
      eveningTime: "22:15",
      dayBeforeReminder: false,
      followUpEnabled: true,
      followUpDelayMinutes: 60,
      timeZone: "America/New_York",
      frequencyMonths: 6,
    });
  });

  it("retient que le premier lancement a été vu", async () => {
    await expect(api.as(alice).settings.update({ onboarded: true })).resolves.toMatchObject({ onboarded: true });
    await expect(api.as(alice).settings.get()).resolves.toMatchObject({ onboarded: true, morningTime: "06:45" });
    await expect(api.as(bob).settings.get()).resolves.toMatchObject({ onboarded: false });
  });

  it("refuse un nom vide, une langue ou un thème inconnus", async () => {
    for (const input of [
      { name: "   " },
      { locale: "de" },
      { theme: "sepia" },
      { timeZone: "Mars/Olympus" },
      { frequencyMonths: 0 },
      { frequencyMonths: 13 },
      { morningTime: "24:00" },
      { eveningTime: "7:30" },
      { followUpDelayMinutes: 5 },
      { followUpDelayMinutes: 241 },
      { followUpDelayMinutes: 30.5 },
      { guideline: "france" },
    ]) {
      await expect(
        // @ts-expect-error valeurs invalides envoyées volontairement
        api.as(bob).settings.update(input),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("refuse un appelant non authentifié", async () => {
    await expect(api.client.settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.client.settings.update({ theme: "dark" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
