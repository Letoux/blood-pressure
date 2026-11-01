import { expect, type Page } from "@playwright/test";
import { e2eAdmin } from "./env";
import { createUserAsAdmin, signIn, test, uniqueUser } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** La fiche d'un utilisateur dans la liste de la page d'administration. */
async function openUserAsAdmin(page: Page, email: string) {
  await signIn(page, e2eAdmin);
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await page.goto("/admin");
  const item = page.getByRole("listitem", { name: email });
  await expect(item).toBeVisible();
  return item;
}

test("après une réinitialisation par l'admin, l'utilisateur voit un bandeau qu'il peut fermer", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Bruno");
  await createUserAsAdmin(request, user);

  const item = await openUserAsAdmin(page, user.email);
  page.once("dialog", (dialog) => dialog.accept("temporaire-123"));
  await item.getByRole("button", { name: "Réinitialiser le mot de passe" }).click();
  await expect(page.getByRole("status")).toContainText("Mot de passe réinitialisé");
  await signOut(page);

  await signIn(page, { email: user.email, password: "temporaire-123" });
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();
  const banner = page.getByRole("region", { name: "Changement de mot de passe conseillé" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Fermer" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();
  await expect(banner).toHaveCount(0);
});

test("l'utilisateur change son mot de passe depuis ses réglages", async ({ page, request }) => {
  const user = uniqueUser("Lucie");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Réglages" }).click();
  await page.getByLabel("Mot de passe actuel").fill(user.password);
  await page.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Mot de passe changé" })).toBeVisible();
  await signOut(page);

  await signIn(page, { email: user.email, password: "nouveau-mot-de-passe" });
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();
});

test("un utilisateur désactivé par l'admin ne peut plus se connecter", async ({ page, request }) => {
  const user = uniqueUser("Chloe");
  await createUserAsAdmin(request, user);

  const item = await openUserAsAdmin(page, user.email);
  page.once("dialog", (dialog) => dialog.accept());
  await item.getByRole("button", { name: "Désactiver" }).click();
  await expect(item).toContainText("Désactivé");
  await signOut(page);

  await signIn(page, user);
  await expect(page.getByText("Ce compte est désactivé.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("un utilisateur ordinaire n'accède pas à la page d'administration", async ({ page, request }) => {
  const user = uniqueUser("Denis");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Administration" })).toHaveCount(0);
});
