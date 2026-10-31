import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseCompose } from "./release-compose";

const repoCompose = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8");
const backupScript = readFileSync(new URL("../../docker/backup.sh", import.meta.url), "utf8");

// Lit le bloc `content: |` d'une config du compose : retire l'indentation et
// l'échappement `$$` de l'interpolation de Compose.
function inlinedConfig(compose: string): string {
  const lines = compose.split("\n");
  const start = lines.findIndex((line) => /^\s*content: \|$/.test(line));
  if (start === -1) throw new Error("aucun bloc `content: |`");
  const indent = (lines[start] ?? "").indexOf("content") + 2;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line !== "" && !line.startsWith(" ".repeat(indent))) break;
    body.push(line.slice(indent));
  }
  return body.join("\n").replace(/\n+$/, "\n").replaceAll("$$", "$");
}

describe("compose de la release", () => {
  it("épingle l'image publiée du tag et ne construit plus rien en local", () => {
    const compose = releaseCompose(repoCompose, "v1.2.3", backupScript);

    expect(compose).toContain("image: ghcr.io/letoux/blood-pressure:v1.2.3\n");
    expect(compose).not.toMatch(/^\s*build:/m);
    expect(compose).not.toContain(":latest");
  });

  it("embarque le script de sauvegarde : seuls le compose et le .env suffisent", () => {
    const compose = releaseCompose(repoCompose, "v1.2.3", backupScript);

    expect(compose).not.toContain("./docker/");
    expect(inlinedConfig(compose)).toBe(backupScript);
  });

  it("échoue si le compose du dépôt ne charge plus le script de sauvegarde", () => {
    const sansScript = repoCompose.replace("file: ./docker/backup.sh", "file: ./autre.sh");

    expect(() => releaseCompose(sansScript, "v1.2.3", backupScript)).toThrow(/backup\.sh/);
  });

  it("échoue si le compose du dépôt ne permet plus d'épingler l'image", () => {
    const sansImage = "services:\n  app:\n    build: .\n";

    expect(() => releaseCompose(sansImage, "v1.2.3", backupScript)).toThrow(/introuvable/);
  });
});
