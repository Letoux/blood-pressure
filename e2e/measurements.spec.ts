import { expect, type Page } from "@playwright/test";
import { createUserAsAdmin, hasHorizontalOverflow, signIn, test, uniqueUser } from "./helpers";

async function fillRow(page: Page, number: number, [systolic, diastolic, pulse]: [string, string, string]) {
  await page.getByLabel(`Systolique, mesure ${number}`).fill(systolic);
  await page.getByLabel(`Diastolique, mesure ${number}`).fill(diastolic);
  await page.getByLabel(`Pouls, mesure ${number}`).fill(pulse);
}

test("saisir 3 mesures d'un créneau, puis les voir, les modifier et les supprimer dans la liste", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Mesures");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();

  const list = page.getByRole("region", { name: "Mes mesures" });
  await expect(list.getByText("Aucune mesure pour l’instant.")).toBeVisible();

  // Le moment et l'horodatage sont pré-remplis.
  await expect(page.getByLabel("Moment")).toHaveValue(/^(morning|evening)$/);
  await expect(page.getByLabel("Date et heure")).not.toHaveValue("");

  await fillRow(page, 1, ["132", "84", "72"]);
  await fillRow(page, 2, ["128", "82", "70"]);
  await fillRow(page, 3, ["182", "100", "75"]);
  await page.getByLabel("Commentaire (facultatif)").fill("Après une nuit courte");

  // Valeur d'alerte : avertissement, mais l'enregistrement reste possible.
  await expect(page.getByText(/^Valeur d’alerte/)).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("3 mesures enregistrées.")).toBeVisible();
  await expect(page.getByLabel("Systolique, mesure 1")).toHaveValue("");

  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(3);
  for (const pressure of ["132/84 mmHg", "128/82 mmHg", "182/100 mmHg"]) {
    await expect(list.getByText(pressure)).toBeVisible();
  }
  await expect(list.getByText("Après une nuit courte")).toHaveCount(3);
  await expect(list.getByText(/Mesure libre/)).toHaveCount(3);

  // Modifier une mesure.
  await items.filter({ hasText: "132/84 mmHg" }).getByRole("button", { name: "Modifier" }).click();
  const editor = list.locator("form");
  await expect(editor.getByLabel("Systolique")).toHaveValue("132");
  await editor.getByLabel("Systolique").fill("134");
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  await expect(list.getByText("134/84 mmHg")).toBeVisible();
  await expect(list.getByText("132/84 mmHg")).toHaveCount(0);

  // Supprimer une mesure, après confirmation.
  const alert = items.filter({ hasText: "182/100 mmHg" });
  await alert.getByRole("button", { name: "Supprimer" }).click();
  await alert.getByRole("button", { name: "Confirmer la suppression" }).click();
  await expect(items).toHaveCount(2);
  await expect(list.getByText("182/100 mmHg")).toHaveCount(0);

  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test("une ligne incomplète ou invalide est signalée et rien n'est enregistré", async ({ page, request }) => {
  const user = uniqueUser("Erreurs");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Saisissez au moins une mesure.")).toBeVisible();

  await fillRow(page, 1, ["120", "80", ""]);
  await fillRow(page, 2, ["80", "120", "70"]);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/laissez la ligne vide/)).toBeVisible();
  await expect(page.getByText("La systolique doit être supérieure à la diastolique.")).toBeVisible();
  await expect(page.getByText("Aucune mesure pour l’instant.")).toBeVisible();
});
