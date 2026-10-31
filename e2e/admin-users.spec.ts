import { expect, test, type Page } from "@playwright/test";
import { e2eAdmin } from "./env";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** L'admin crée un utilisateur depuis la page d'administration. */
async function createUser(page: Page, user: { email: string; name: string; password: string }) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Nom").fill(user.name);
  await page.getByLabel("Mot de passe initial").fill(user.password);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("row", { name: new RegExp(user.email) })).toBeVisible();
}

test("après une réinitialisation par l'admin, l'utilisateur voit un bandeau qu'il peut fermer", async ({ page }) => {
  // La base E2E persiste d'un lancement à l'autre : un email unique par exécution.
  const user = { email: `reset-${Date.now()}@e2e.test`, name: "Bruno", password: "initial-password" };

  await signIn(page, e2eAdmin.email, e2eAdmin.password);
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await createUser(page, user);

  const row = page.getByRole("row", { name: new RegExp(user.email) });
  page.once("dialog", (dialog) => dialog.accept("temporaire-123"));
  await row.getByRole("button", { name: "Réinitialiser le mot de passe" }).click();
  await expect(page.getByRole("status")).toContainText("Mot de passe réinitialisé");
  await signOut(page);

  await signIn(page, user.email, "temporaire-123");
  const banner = page.getByRole("region", { name: "Changer mon mot de passe" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Fermer" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();
  await expect(banner).toHaveCount(0);
});

test("un utilisateur désactivé par l'admin ne peut plus se connecter", async ({ page }) => {
  const user = { email: `disabled-${Date.now()}@e2e.test`, name: "Chloé", password: "chloe-password" };

  await signIn(page, e2eAdmin.email, e2eAdmin.password);
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await createUser(page, user);

  const row = page.getByRole("row", { name: new RegExp(user.email) });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Désactiver" }).click();
  await expect(row).toContainText("Désactivé");
  await signOut(page);

  await signIn(page, user.email, user.password);
  await expect(page.getByRole("alert")).toContainText("désactivé");
  await expect(page).toHaveURL(/\/login$/);
});

test("un utilisateur ordinaire n'accède pas à la page d'administration", async ({ page }) => {
  const user = { email: `plain-${Date.now()}@e2e.test`, name: "Denis", password: "denis-password" };

  await signIn(page, e2eAdmin.email, e2eAdmin.password);
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await createUser(page, user);
  await signOut(page);

  await signIn(page, user.email, user.password);
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Administration" })).toHaveCount(0);
});
