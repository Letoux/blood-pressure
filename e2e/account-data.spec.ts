import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { createUserAsAdmin, signIn, test, uniqueUser } from "./helpers";

test("exporter ses mesures en CSV, puis supprimer son compte avec son mot de passe", async ({ page, request }) => {
  const user = uniqueUser("Export");
  await createUserAsAdmin(request, user);
  await signIn(page, user);

  // Une mesure, avec un commentaire qui contient une virgule.
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();
  await page.getByLabel("Systolique, mesure 1").fill("132");
  await page.getByLabel("Diastolique, mesure 1").fill("84");
  await page.getByLabel("Pouls, mesure 1").fill("72");
  await page.getByLabel("Commentaire (facultatif)").fill("Calme, assis");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("1 mesure enregistrée.")).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Réglages" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le CSV" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^tension-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), "utf8");
  expect(csv.startsWith("﻿Date,Heure,Fuseau horaire,")).toBe(true);
  expect(csv).toMatch(/,132,84,72,"Calme, assis",oui,,,(Matin|Soir),\r\n$/);

  // Mauvais mot de passe : refusé, le compte reste.
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mdp");
  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  await expect(page.getByText("Le mot de passe est incorrect.")).toBeVisible();

  await page.getByLabel("Mot de passe", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Le compte n'existe plus.
  await signIn(page, user);
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
});
