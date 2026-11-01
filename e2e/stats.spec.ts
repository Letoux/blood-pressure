import { expect } from "@playwright/test";
import { createUserAsAdmin, hasHorizontalOverflow, signIn, test, uniqueUser } from "./helpers";
import { daysAgo, seedCampaign, seedFreeMeasurement } from "./seed";

// Fuseau fixé (détecté puis enregistré dans les réglages), et la plus petite largeur visée.
test.use({ timezoneId: "Europe/Paris", viewport: { width: 360, height: 780 } });

test("voir ses campagnes face au seuil du référentiel, puis changer de référentiel", async ({ page, request }) => {
  const user = uniqueUser("Stats");
  await createUserAsAdmin(request, user);
  // Une campagne complète à 140/90, puis une incomplète (14/18) à 132/82, et une mesure libre.
  await seedCampaign(user.email, daysAgo(40), 18, { systolic: 140, diastolic: 90 });
  await seedCampaign(user.email, daysAgo(10), 14, { systolic: 132, diastolic: 82 });
  await seedFreeMeasurement(user.email, daysAgo(20), { systolic: 171, diastolic: 101 });
  await signIn(page, user);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Statistiques" })).toBeVisible();

  await page.goto("/stats");
  const chart = page.getByRole("figure", { name: "Moyennes des campagnes" });
  await expect(chart).toBeVisible();

  // Un point par campagne et par série : pleins pour la complète, creux pour l'incomplète.
  await expect(chart.locator('circle[data-complete="true"]')).toHaveCount(2);
  await expect(chart.locator('circle[data-complete="false"]')).toHaveCount(2);
  // Le seuil SFHTA (par défaut) en deux lignes.
  await expect(chart.locator(".recharts-label")).toHaveText(["135", "85"]);

  // L'info-bulle d'une campagne incomplète indique n/18.
  await chart.locator('circle[data-complete="false"]').first().hover();
  await expect(chart.getByText("Incomplète : 14/18 mesures")).toBeVisible();

  // La pastille situe la dernière campagne, avec la mention fixe, sans diagnostic.
  const standing = page.getByRole("status");
  await expect(standing).toHaveText("Sous le seuil SFHTA (135/85)");
  await expect(page.getByText("Ne remplace pas un avis médical.")).toBeVisible();
  // « hypertension » n'apparaît que dans le nom d'une société savante, jamais comme diagnostic.
  const text = (await page.getByRole("main").innerText()).replaceAll(/Société française d.hypertension artérielle/gi, "");
  expect(text).not.toMatch(/hypertension/i);

  // Les mesures libres sont listées à part, jamais sur la courbe.
  const free = page.getByRole("region", { name: "Mesures libres" });
  await expect(free.getByText("171/101 mmHg")).toBeVisible();
  await expect(chart.getByText(/171/)).toHaveCount(0);

  expect(await hasHorizontalOverflow(page)).toBe(false);

  // Changer de référentiel : ACC/AHA 2017, seuil 130/80.
  await page.getByRole("link", { name: "Changer de référentiel" }).click();
  const guideline = page.getByLabel("Référentiel", { exact: true });
  await guideline.selectOption({ label: "ACC/AHA 2017 (130/80)" });
  const form = page.locator("form").filter({ has: guideline });
  await expect(form.getByText(/^American College of Cardiology/)).toBeVisible();
  await form.getByRole("button", { name: "Enregistrer le référentiel" }).click();
  await expect(page.getByText("Référentiel enregistré.")).toBeVisible();

  await page.goto("/stats");
  await expect(chart.locator(".recharts-label")).toHaveText(["130", "80"]);
  await expect(page.getByRole("status")).toHaveText("Atteint ou dépasse le seuil ACC/AHA 2017 (130/80)");
  await expect(page.getByText("Ne remplace pas un avis médical.")).toBeVisible();
});

test("le graphique reste lisible en thème sombre : ses couleurs changent avec le thème", async ({ page, request }) => {
  const user = uniqueUser("Sombre");
  await createUserAsAdmin(request, user);
  await seedCampaign(user.email, daysAgo(40), 18, { systolic: 140, diastolic: 90 });
  await seedCampaign(user.email, daysAgo(10), 18, { systolic: 132, diastolic: 82 });
  await signIn(page, user);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Statistiques" })).toBeVisible();

  // Thème « système » (par défaut) : il suit le navigateur.
  const systolicColor = () =>
    page.locator(".recharts-line-curve").first().evaluate((path) => getComputedStyle(path).stroke);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/stats");
  const chart = page.getByRole("figure", { name: "Moyennes des campagnes" });
  await expect(chart.locator(".recharts-label")).toHaveText(["135", "85"]);
  const light = await systolicColor();

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(chart.locator(".recharts-label")).toHaveText(["135", "85"]);
  await expect(chart.locator('circle[data-complete="true"]')).toHaveCount(4);
  const dark = await systolicColor();
  expect(dark).not.toBe(light);
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
