import { expect, type Page } from "@playwright/test";
import { createUserAsAdmin, hasHorizontalOverflow, signIn, test, uniqueUser } from "./helpers";
import { daysAgo, seedPlannedCampaign } from "./seed";

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

  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test("une campagne à venir s'annonce à sa date, sans créneau du jour ni bouton pour la sauter", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Future");
  await createUserAsAdmin(request, user);
  await seedPlannedCampaign(user.email, daysAgo(-5));
  await signIn(page, user);

  await expect(page.getByText("Prochaine campagne")).toBeVisible();
  await expect(page.getByText(/^Le /)).toBeVisible();
  await expect(page.getByRole("list", { name: "Créneaux du jour" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sauter la campagne" })).toHaveCount(0);
});

test("une campagne en retard se commence encore, ou se saute et reste visible comme « sautée »", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Retard");
  await createUserAsAdmin(request, user);
  await seedPlannedCampaign(user.email, daysAgo(3));
  await signIn(page, user);

  // En retard : la première mesure la commencerait aujourd'hui.
  await expect(page.getByText(/elle est en retard/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Créneaux du jour" }).getByText("À faire")).toHaveCount(2);

  // En voyage : on la saute, avec confirmation.
  await page.getByRole("button", { name: "Sauter la campagne" }).click();
  await page.getByRole("button", { name: "Confirmer : sauter la campagne" }).click();
  const history = page.getByRole("region", { name: "Mes campagnes" });
  await expect(history.getByText("Sautée", { exact: true })).toBeVisible();
  await expect(history.getByText(/, sautée le /)).toBeVisible();
  // La suivante est planifiée selon la fréquence, sans créneau aujourd'hui.
  await expect(page.getByText("Prochaine campagne")).toBeVisible();
  await expect(page.getByRole("list", { name: "Créneaux du jour" })).toHaveCount(0);
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test("une campagne manquée reste visible, et un rattrapage est proposé tout de suite", async ({ page, request }) => {
  const user = uniqueUser("Manquee");
  await createUserAsAdmin(request, user);
  // Prévue il y a 10 jours, sans mesure : manquée il y a 3 jours, rattrapage depuis.
  await seedPlannedCampaign(user.email, daysAgo(10));
  await signIn(page, user);

  await expect(page.getByText("Campagne de rattrapage", { exact: true })).toBeVisible();
  await expect(page.getByText(/a été manquée/)).toBeVisible();
  const history = page.getByRole("region", { name: "Mes campagnes" });
  await expect(history.getByText("Manquée", { exact: true })).toBeVisible();

  // Une saisie aujourd'hui commence le rattrapage.
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();
  await fillRow(page, 1, ["130", "80", "70"]);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/^1 mesure enregistrée \(J1 (matin|soir)\)\.$/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Campagne en cours")).toBeVisible();
  await expect(history.getByText("Rattrapage", { exact: true })).toBeVisible();
  await expect(history.getByText("Manquée", { exact: true })).toBeVisible();
});
