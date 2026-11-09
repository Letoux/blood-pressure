import { expect, type Page } from "@playwright/test";
import { createUserAsAdmin, hasHorizontalOverflow, signIn, test, uniqueUser } from "./helpers";

async function fillRow(page: Page, number: number, [systolic, diastolic, pulse]: [string, string, string]) {
  await page.getByLabel(`Systolique, mesure ${number}`).fill(systolic);
  await page.getByLabel(`Diastolique, mesure ${number}`).fill(diastolic);
  await page.getByLabel(`Pouls, mesure ${number}`).fill(pulse);
}

test("saisir les valeurs au clavier sans cliquer : chaque valeur complète passe au champ suivant", async ({
  page,
  request,
}) => {
  const user = uniqueUser("Clavier");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();

  await expect(page.getByLabel("Systolique, mesure 1")).toBeFocused();
  // 132/84/72, 128/82/70, puis 95 (systolique à 2 chiffres) / 100 (diastolique à 3) / 64.
  await page.keyboard.type("1328472128827095" + "10064");

  const values = [
    ["132", "84", "72"],
    ["128", "82", "70"],
    ["95", "100", "64"],
  ];
  for (const [index, [systolic, diastolic, pulse]] of values.entries()) {
    const number = index + 1;
    await expect(page.getByLabel(`Systolique, mesure ${number}`)).toHaveValue(systolic!);
    await expect(page.getByLabel(`Diastolique, mesure ${number}`)).toHaveValue(diastolic!);
    await expect(page.getByLabel(`Pouls, mesure ${number}`)).toHaveValue(pulse!);
  }
});

test("minuteur : 5 minutes de repos, puis 1 minute relancée par le premier chiffre des mesures 1 et 2, avec pause et recommencer", async ({
  page,
  request,
}) => {
  await page.clock.install();
  const user = uniqueUser("Minuteur");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();

  await page.getByRole("button", { name: "Démarrer le repos (5 min)" }).click();
  const rest = page.getByRole("timer", { name: "Repos assis avant la mesure 1" });
  await expect(rest).toHaveText("5:00");
  await page.clock.runFor("02:00");
  await expect(rest).toHaveText("3:00");
  await page.clock.runFor("03:00");
  await expect(page.getByText("C’est le moment de la mesure 1.")).toBeVisible();

  // Le premier chiffre de la mesure 1 lance 1 minute avant la mesure 2.
  await page.getByLabel("Systolique, mesure 1").pressSequentially("1");
  const beforeSecond = page.getByRole("timer", { name: "Avant la mesure 2" });
  await expect(beforeSecond).toHaveText("1:00");
  await page.keyboard.type("328472");

  // En pause, le temps restant est figé, mais commencer la mesure 2 relance quand même l'intervalle.
  await page.clock.runFor("00:10");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.clock.runFor("05:00");
  await expect(beforeSecond).toHaveText("0:50");
  await page.getByLabel("Systolique, mesure 2").pressSequentially("1");
  const beforeThird = page.getByRole("timer", { name: "Avant la mesure 3" });
  await expect(beforeThird).toHaveText("1:00");
  await page.keyboard.type("288270");

  // Pause, reprise là où il s'était arrêté, puis recommencer depuis 1:00.
  await page.clock.runFor("00:15");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.clock.runFor("02:00");
  await expect(beforeThird).toHaveText("0:45");
  await page.getByRole("button", { name: "Reprendre" }).click();
  await page.clock.runFor("00:20");
  await expect(beforeThird).toHaveText("0:25");
  await page.getByRole("button", { name: "Recommencer" }).click();
  await expect(beforeThird).toHaveText("1:00");
  await page.clock.runFor("01:00");
  await expect(page.getByText("C’est le moment de la mesure 3.")).toBeVisible();

  // La mesure 3 arrête le minuteur.
  await page.getByLabel("Systolique, mesure 3").pressSequentially("1");
  await expect(page.getByRole("button", { name: "Démarrer le repos (5 min)" })).toBeVisible();
});

test("mode manuel : ni passage au champ suivant ni minuteur relancé par la saisie, et il est retenu", async ({
  page,
  request,
}) => {
  await page.clock.install();
  const user = uniqueUser("Manuel");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await page.getByRole("navigation").getByRole("link", { name: "Saisie" }).click();

  await page.getByLabel("Passer seul au champ suivant").uncheck();
  await page.getByLabel("Minuteur automatique (relancé à chaque mesure)").uncheck();
  await expect(page.getByLabel("Minuteur automatique (relancé à chaque mesure)")).not.toBeChecked();

  // Les chiffres restent dans le champ qui a le focus, et la saisie ne lance aucun minuteur.
  await page.getByLabel("Systolique, mesure 1").pressSequentially("13284");
  await expect(page.getByLabel("Systolique, mesure 1")).toHaveValue("13284");
  await expect(page.getByRole("timer")).toHaveCount(0);

  // Le minuteur se lance à la main : repos ou intervalle.
  await page.getByRole("button", { name: "Intervalle (1 min)" }).click();
  await expect(page.getByRole("timer", { name: "Avant la mesure suivante" })).toHaveText("1:00");
  await page.clock.runFor("01:00");
  await expect(page.getByText("C’est le moment de la mesure suivante.")).toBeVisible();
  await page.getByRole("button", { name: "Repos (5 min)" }).click();
  await expect(page.getByRole("timer", { name: "Repos assis avant la mesure 1" })).toHaveText("5:00");

  // Le mode est un réglage : il est retenu au prochain passage.
  await page.reload();
  await expect(page.getByLabel("Passer seul au champ suivant")).not.toBeChecked();
  await expect(page.getByLabel("Minuteur automatique (relancé à chaque mesure)")).not.toBeChecked();
});

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
