import { expect, type Page } from "@playwright/test";
import { createUserAsAdmin, signIn, test, uniqueUser } from "./helpers";

// Navigateur en anglais : sans langue enregistrée, l'interface suit le navigateur.
test.use({ locale: "en-US", viewport: { width: 360, height: 740 } });

const nav = (page: Page) => page.getByRole("navigation");

async function hasHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

test("l'interface suit le navigateur, puis la langue, le thème et le nom enregistrés", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Alice");
  await createUserAsAdmin(request, user);
  await signIn(page, user);

  // En anglais, à 360 px, sans défilement horizontal.
  await expect(page.getByRole("heading", { name: `Hello ${user.name}` })).toBeVisible();
  for (const label of ["Home", "Entry", "Statistics", "Report", "Settings"]) {
    await expect(nav(page).getByRole("link", { name: label })).toBeVisible();
  }
  expect(await hasHorizontalScroll(page)).toBe(false);

  await nav(page).getByRole("link", { name: "Statistics" }).click();
  await expect(page.getByText("Coming soon")).toBeVisible();

  await nav(page).getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Display name").fill("Alice D.");
  await page.getByLabel("Language").selectOption("fr");
  await page.getByLabel("Theme").selectOption("dark");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Appliqué aussitôt : le libellé de navigation passe en français.
  await expect(nav(page).getByRole("link", { name: "Accueil" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  expect(await hasHorizontalScroll(page)).toBe(false);

  // Session suivante : langue, thème et nom rendus par le serveur dès le premier octet.
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "Bonjour Alice D." })).toBeVisible();

  const response = await page.request.get("/");
  const html = await response.text();
  expect(html).toMatch(/<html[^>]*lang="fr"/);
  expect(html).toMatch(/<html[^>]*data-theme="dark"/);
});
