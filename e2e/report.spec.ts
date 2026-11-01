import { expect } from "@playwright/test";
import { createUserAsAdmin, hasHorizontalOverflow, signIn, test, uniqueUser } from "./helpers";
import { daysAgo, seedCampaign, seedFreeMeasurement, seedPlannedCampaign } from "./seed";

test.use({ timezoneId: "Europe/Paris", viewport: { width: 360, height: 780 } });

test("compte rendu sur « tout » : carte de campagne incomplète, à l'écran et à l'impression", async ({ page, request }) => {
  const user = uniqueUser("Rapport");
  await createUserAsAdmin(request, user);
  // Une campagne complète à 140/90 il y a 40 jours, une incomplète (14/18, sans J3 soir) à
  // 132/82 il y a 10 jours, et une mesure libre qui ne doit pas apparaître.
  await seedCampaign(user.email, daysAgo(40), 18, { systolic: 140, diastolic: 90 });
  await seedCampaign(user.email, daysAgo(10), 14, { systolic: 132, diastolic: 82 });
  await seedFreeMeasurement(user.email, daysAgo(20), { systolic: 171, diastolic: 101 });
  await signIn(page, user);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Compte rendu" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Compte rendu" }).click();
  await page.getByLabel("Période", { exact: true }).selectOption({ label: "Tout" });

  // Résumé : deux campagnes, dont une complète, et le graphique avec le seuil.
  const summary = page.getByRole("region", { name: "Résumé de la période" });
  await expect(summary.getByText("2 campagnes, dont 1 complète (50 %)")).toBeVisible();
  await expect(summary.getByRole("figure", { name: "Moyennes des campagnes" })).toBeVisible();
  await expect(page.getByText("Ne remplace pas un avis médical.")).toBeVisible();

  // Une carte par campagne ; l'incomplète porte son bandeau et son écart avec la précédente.
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(2);
  const incomplete = cards.filter({ hasText: "Campagne incomplète" });
  const banner = incomplete.getByText("Campagne incomplète : 14/18 mesures, créneaux manquants : J3 soir");
  await expect(banner).toBeVisible();
  await expect(incomplete.getByText("Écart avec la campagne précédente : −8/−8 mmHg")).toBeVisible();

  // Le tableau des mesures se déplie.
  const table = incomplete.getByRole("table", { name: "Mesures de la campagne" });
  await expect(table).toBeHidden();
  await incomplete.getByText("Voir les mesures (14)").click();
  await expect(table).toBeVisible();

  // Les mesures libres sont absentes du compte rendu.
  await expect(page.getByText(/171/)).toHaveCount(0);
  expect(await hasHorizontalOverflow(page)).toBe(false);

  // Impression : navigation masquée, bandeau conservé, tableaux dépliés, en-tête nom et période.
  await page.evaluate(() => {
    window.print = () => document.body.setAttribute("data-printed", "true");
  });
  await page.getByRole("button", { name: "Imprimer / PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "true");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation")).toBeHidden();
  await expect(page.getByRole("button", { name: "Imprimer / PDF" })).toBeHidden();
  await expect(page.getByLabel("Période", { exact: true })).toBeHidden();
  await expect(banner).toBeVisible();
  await expect(page.getByText(`${user.name} · Tout`)).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card.getByRole("table", { name: "Mesures de la campagne" })).toBeVisible();
  }
  await expect(page.getByText("Ne remplace pas un avis médical.")).toBeVisible();
});

test("sans campagne terminée, le résumé compte quand même les campagnes manquées", async ({ page, request }) => {
  const user = uniqueUser("RapportManque");
  await createUserAsAdmin(request, user);
  // Prévue il y a 20 jours, sans mesure : manquée, puis son rattrapage aussi ; le suivant est en cours.
  await seedPlannedCampaign(user.email, daysAgo(20));
  await signIn(page, user);

  await page.getByRole("navigation").getByRole("link", { name: "Compte rendu" }).click();
  await page.getByLabel("Période", { exact: true }).selectOption({ label: "Tout" });
  const summary = page.getByRole("region", { name: "Résumé de la période" });
  await expect(summary.getByText("Aucune campagne terminée sur cette période.")).toBeVisible();
  await expect(summary.getByText("2 campagnes manquées, aucune sautée")).toBeVisible();
});
