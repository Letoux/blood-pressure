import { expect, type Page } from "@playwright/test";
import { createUserAsAdmin, signIn, test, uniqueUser } from "./helpers";

// Fuseau fixé : il est détecté depuis le navigateur et enregistré dans les réglages.
test.use({ timezoneId: "Europe/Paris" });

async function fillRow(page: Page, number: number, [systolic, diastolic, pulse]: [string, string, string]) {
  await page.getByLabel(`Systolique, mesure ${number}`).fill(systolic);
  await page.getByLabel(`Diastolique, mesure ${number}`).fill(diastolic);
  await page.getByLabel(`Pouls, mesure ${number}`).fill(pulse);
}

test("planifier sa première campagne, remplir un créneau, puis voir sa progression", async ({ page, request }) => {
  const user = uniqueUser("Campagne");
  await createUserAsAdmin(request, user);
  await signIn(page, user);

  // Aucune campagne : on choisit la date de la première (aujourd'hui par défaut).
  await expect(page.getByText("Aucune campagne planifiée")).toBeVisible();
  await expect(page.getByLabel("Date de début")).not.toHaveValue("");
  await page.getByRole("button", { name: "Planifier ma première campagne" }).click();

  // Planifiée aujourd'hui : les créneaux du jour sont à faire.
  const today = page.getByRole("list", { name: "Créneaux du jour" });
  await expect(page.getByText(/peut commencer aujourd’hui/)).toBeVisible();
  await expect(today.getByText("À faire")).toHaveCount(2);

  // Le fuseau du navigateur a été enregistré dans les réglages.
  await page.getByRole("navigation").getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByLabel("Fuseau horaire")).toHaveValue("Europe/Paris");
  await expect(page.getByLabel("Fréquence des campagnes")).toHaveValue("3");

  // Remplir le créneau en cours : la saisie est rattachée à J1.
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();
  await expect(page.getByText(/rattachées au créneau/)).toBeVisible();
  await fillRow(page, 1, ["132", "84", "72"]);
  await fillRow(page, 2, ["128", "82", "70"]);
  await fillRow(page, 3, ["126", "80", "71"]);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/^3 mesures enregistrées \(J1 (matin|soir)\)\.$/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Mes mesures" }).getByText(/J1 (matin|soir)/)).toHaveCount(3);

  // L'accueil montre la campagne en cours, sa progression et le créneau du jour rempli.
  // (Pas de clic sur « Accueil » : en dev, le bouton des outils Next.js le recouvre.)
  await page.goto("/");
  await expect(page.getByText("Campagne en cours")).toBeVisible();
  await expect(page.getByText("3/18 mesures").first()).toBeVisible();
  await expect(today.getByText("Rempli (3/3)")).toBeVisible();
  await expect(today.getByText("À faire")).toHaveCount(1);

  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
