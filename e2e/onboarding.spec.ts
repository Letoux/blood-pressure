import { devices, expect } from "@playwright/test";
import { createUserAsAdmin, signIn, test, uniqueUser } from "./helpers";

test("le premier lancement s'affiche une seule fois, chaque étape se passe et se retrouve dans les Réglages", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Lea");
  await createUserAsAdmin(request, user, { onboarded: false });
  await signIn(page, user);

  // 1. Protocole de mesure. (Délai large : en développement, la page se compile à la première visite.)
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: "Protocole de mesure" })).toBeVisible();
  await expect(page.getByText("assis depuis 5 minutes")).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();

  // 2. Installation (Pixel 7 : instructions Android), passée.
  await expect(page.getByRole("heading", { name: "Installer l’application" })).toBeVisible();
  await expect(page.getByText("Dans Chrome, ouvrez le menu")).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();

  // 3. Notifications, passée.
  await expect(page.getByText("Étape 3 sur 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();

  // 4. Rappels : rappel la veille activé et relance désactivée par défaut.
  await expect(page.getByLabel("Rappel la veille d’une campagne")).toBeChecked();
  await expect(page.getByLabel("Relance si le créneau n’est toujours pas rempli")).not.toBeChecked();
  await page.getByLabel("Heure du matin").fill("06:45");
  await page.getByLabel("Relance si le créneau n’est toujours pas rempli").check();
  await page.getByLabel("Délai de la relance").selectOption({ label: "1 heure" });
  await page.getByRole("button", { name: "Enregistrer et terminer" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Lea" })).toBeVisible();

  // Vu une fois : l'accueil ne le rouvre plus, même après une nouvelle connexion.
  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "Bonjour Lea" })).toBeVisible();

  // Les étapes se retrouvent dans les Réglages, avec les rappels enregistrés.
  await page.getByRole("navigation").getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByText("Rappels", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Heure du matin")).toHaveValue("06:45");
  await expect(page.getByLabel("Délai de la relance")).toHaveValue("60");
  await expect(page.getByText("Protocole de mesure", { exact: true })).toBeVisible();
  await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Installer l’application" })).toBeVisible();
  await page.getByRole("link", { name: "Revoir le premier lancement" }).click();
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
});

test("le protocole est aussi disponible en anglais", async ({ browser, request }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "en-US" });
  const page = await context.newPage();
  const user = uniqueUser("Max");
  await createUserAsAdmin(request, user, { onboarded: false });
  await signIn(page, user);

  await expect(page.getByRole("heading", { name: "Measurement protocol" })).toBeVisible();
  await expect(page.getByText("seated for 5 minutes")).toBeVisible();
  await context.close();
});

test.describe("sur iPhone, hors application installée", () => {
  test.use({ userAgent: devices["iPhone 15"].userAgent });

  test("l'étape des notifications explique qu'il faut d'abord installer l'application", async ({
    page,
    request,
  }) => {
    const user = uniqueUser("Nina");
    await createUserAsAdmin(request, user, { onboarded: false });
    await signIn(page, user);
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByRole("button", { name: "Suivant" }).click();

    await expect(page.getByText("ne fonctionnent qu’une fois l’application installée")).toBeVisible();
    await expect(page.getByRole("button", { name: "Activer les notifications" })).toHaveCount(0);
    await page.getByRole("link", { name: "Voir comment l’installer" }).click();
    await expect(page.getByText("Touchez le bouton Partager")).toBeVisible();
  });
});
