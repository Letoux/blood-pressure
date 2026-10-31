import { devices, expect } from "@playwright/test";
import { createUserAsAdmin, signIn, test, uniqueUser } from "./helpers";

// Le service worker n'est enregistré qu'en production : en CI (`pnpm build` puis `pnpm start`).
const production = Boolean(process.env.CI);

test("le manifeste rend l'app installable", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/" });

  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test("hors ligne, un bandeau s'affiche et l'enregistrement est désactivé", async ({ page, context, request }) => {
  const user = uniqueUser("Hugo");
  await createUserAsAdmin(request, user);
  await signIn(page, user);
  await page.getByRole("navigation").getByRole("link", { name: "Réglages" }).click();
  const save = page.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(save).toBeEnabled();

  await context.setOffline(true);
  await expect(page.getByRole("alert").filter({ hasText: "Pas de réseau" })).toBeVisible();
  await expect(save).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText("Pas de réseau")).toHaveCount(0);
  await expect(save).toBeEnabled();
});

test.describe("page d'installation", () => {
  test("sur Android, les instructions de Chrome", async ({ page, request }) => {
    const user = uniqueUser("Ines");
    await createUserAsAdmin(request, user);
    await signIn(page, user);
    await page.getByRole("navigation").getByRole("link", { name: "Réglages" }).click();
    await page.getByRole("link", { name: "Installer l’application" }).click();

    await expect(page.getByRole("heading", { name: "Android" })).toBeVisible();
    await expect(page.getByText("Dans Chrome, ouvrez le menu")).toBeVisible();
    await expect(page.getByText("Touchez le bouton Partager")).toBeHidden();
  });

  test.describe("sur iPhone", () => {
    test.use({ userAgent: devices["iPhone 15"].userAgent });

    test("les instructions de Safari", async ({ page, request }) => {
      const user = uniqueUser("Jules");
      await createUserAsAdmin(request, user);
      await signIn(page, user);
      await expect(page.getByRole("navigation")).toBeVisible();
      await page.goto("/install");

      await expect(page.getByRole("heading", { name: "iPhone et iPad" })).toBeVisible();
      await expect(page.getByText("Touchez le bouton Partager")).toBeVisible();
      await expect(page.getByText("« Sur l’écran d’accueil »")).toBeVisible();
      await expect(page.getByText("Dans Chrome, ouvrez le menu")).toBeHidden();
    });
  });
});

test.describe("service worker", () => {
  test.skip(!production, "enregistré seulement en production");

  test("il met en cache les ressources statiques et la page hors ligne", async ({ page, context, request }) => {
    const user = uniqueUser("Karim");
    await createUserAsAdmin(request, user);
    await signIn(page, user);
    await expect(page.getByRole("navigation")).toBeVisible();

    const scriptURL = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
    expect(scriptURL).toMatch(/\/serwist\/sw\.js$/);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const entry of await (await caches.open(name)).keys()) urls.push(new URL(entry.url).pathname);
      }
      return urls;
    });
    expect(cached.some((url) => url.startsWith("/_next/static/"))).toBe(true);
    expect(cached).toContain("/offline");

    // Sans réseau, une page demandée est remplacée par la page hors ligne.
    await context.setOffline(true);
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Pas de réseau" })).toBeVisible();
  });
});
