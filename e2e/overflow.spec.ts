import { expect } from "@playwright/test";
import { createUserAsAdmin, hasHorizontalOverflow, signIn, test, uniqueUser } from "./helpers";
import { daysAgo, seedCampaign, seedFreeMeasurement, seedPlannedCampaign } from "./seed";

// La plus petite largeur visée (#5) : aucune page ne défile horizontalement.
test.use({ timezoneId: "Europe/Paris", viewport: { width: 360, height: 780 } });

const PUBLIC_PAGES = ["/login", "/signup", "/offline", "/health"];
const CONNECTED_PAGES = ["/", "/entry", "/stats", "/report", "/settings", "/install", "/welcome"];

test("aucune page publique ne déborde à 360 px", async ({ page }) => {
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await hasHorizontalOverflow(page), path).toBe(false);
  }
});

test("aucune page connectée ne déborde à 360 px, avec un historique bien rempli", async ({ page, request }) => {
  const user = uniqueUser("Largeur");
  await createUserAsAdmin(request, user);
  // Campagnes complète, incomplète et manquée (avec son rattrapage), et une mesure libre.
  await seedCampaign(user.email, daysAgo(60), 18, { systolic: 140, diastolic: 90 });
  await seedCampaign(user.email, daysAgo(30), 14, { systolic: 132, diastolic: 82 });
  await seedPlannedCampaign(user.email, daysAgo(10));
  await seedFreeMeasurement(user.email, daysAgo(20), { systolic: 171, diastolic: 101 });
  await signIn(page, user);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Compte rendu" })).toBeVisible();

  for (const path of CONNECTED_PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await hasHorizontalOverflow(page), path).toBe(false);
  }
});
