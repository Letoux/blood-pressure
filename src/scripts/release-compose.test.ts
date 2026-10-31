import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseCompose } from "./release-compose";

const repoCompose = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8");

describe("compose de la release", () => {
  it("épingle l'image publiée du tag et ne construit plus rien en local", () => {
    const compose = releaseCompose(repoCompose, "v1.2.3");

    expect(compose).toContain("image: ghcr.io/letoux/blood-pressure:v1.2.3\n");
    expect(compose).not.toMatch(/^\s*build:/m);
    expect(compose).not.toContain(":latest");
  });

  it("échoue si le compose du dépôt ne permet plus d'épingler l'image", () => {
    const sansImage = "services:\n  app:\n    build: .\n";

    expect(() => releaseCompose(sansImage, "v1.2.3")).toThrow(/introuvable/);
  });
});
