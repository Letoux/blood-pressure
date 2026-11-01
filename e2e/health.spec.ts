import { expect } from "@playwright/test";
import { test } from "./helpers";

test("la page de santé affiche OK depuis la base", async ({ page }) => {
  await page.goto("/health");
  await expect(page.getByRole("status")).toHaveText("OK");
});
