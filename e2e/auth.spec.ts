import { expect, type Page } from "@playwright/test";
import { e2eAdmin } from "./env";
import { test } from "./helpers";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("l'admin crée un utilisateur, qui se connecte puis se déconnecte", async ({ page }) => {
  // La base E2E persiste d'un lancement à l'autre : un email unique par exécution.
  const user = {
    email: `alice-${Date.now()}@e2e.test`,
    name: "Alice",
    password: "alice-password",
  };

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, e2eAdmin.email, e2eAdmin.password);
  await page.getByRole("link", { name: "Gérer les utilisateurs" }).click();

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Nom").fill(user.name);
  await page.getByLabel("Mot de passe initial").fill(user.password);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("status")).toContainText(user.email);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Un nouvel utilisateur commence par le premier lancement.
  await signIn(page, user.email, user.password);
  await expect(page.getByRole("heading", { name: "Bienvenue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gérer les utilisateurs" })).toHaveCount(0);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
