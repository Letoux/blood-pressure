import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webManifest } from "./web-manifest";

const manifest = webManifest({ name: "Tension", description: "Suivi de l'automesure tensionnelle" });

describe("manifeste de la PWA", () => {
  it("s'ouvre en plein écran, comme une app, sur l'accueil", () => {
    expect(manifest).toMatchObject({
      name: "Tension",
      short_name: "Tension",
      description: "Suivi de l'automesure tensionnelle",
      display: "standalone",
      start_url: "/",
      scope: "/",
    });
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("a les icônes PNG 192 et 512 px exigées par Chrome, dont une adaptable (maskable)", () => {
    const icons = manifest.icons ?? [];
    const png = (size: string, purpose?: string) =>
      icons.some((icon) => icon.type === "image/png" && icon.sizes === size && icon.purpose === purpose);

    expect(png("192x192")).toBe(true);
    expect(png("512x512")).toBe(true);
    expect(png("512x512", "maskable")).toBe(true);
  });

  it("pointe vers des icônes qui existent", () => {
    for (const icon of manifest.icons ?? []) {
      expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
    }
  });
});
