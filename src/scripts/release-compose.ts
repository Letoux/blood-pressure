// Produit le `docker-compose.yml` joint à chaque GitHub Release : celui du dépôt,
// mais épinglé sur l'image publiée pour le tag, sans build local, et avec le script
// de sauvegarde embarqué : le compose et le `.env` suffisent à installer.
// Usage (Node 24, sans dépendance) : `node src/scripts/release-compose.ts v1.2.3 > docker-compose.yml`
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const IMAGE_REPOSITORY = "ghcr.io/letoux/blood-pressure";
export const BACKUP_SCRIPT_PATH = "./docker/backup.sh";

const IMAGE_LINE = /^(\s*)image: \$\{IMAGE:-ghcr\.io\/letoux\/blood-pressure:latest\}$/m;
const BUILD_LINE = /^\s*build: \.\n/m;
const BACKUP_SCRIPT_LINE = /^(\s*)file: \.\/docker\/backup\.sh$/m;

export function releaseCompose(source: string, tag: string, backupScript: string): string {
  if (!IMAGE_LINE.test(source) || !BUILD_LINE.test(source)) {
    throw new Error(
      "docker-compose.yml : ligne `image: ${IMAGE:-…:latest}` ou `build: .` introuvable, adapter release-compose.ts",
    );
  }
  if (!BACKUP_SCRIPT_LINE.test(source)) {
    throw new Error(
      `docker-compose.yml : config \`file: ${BACKUP_SCRIPT_PATH}\` introuvable, adapter release-compose.ts`,
    );
  }
  return source
    .replace(IMAGE_LINE, `$1image: ${IMAGE_REPOSITORY}:${tag}`)
    .replace(BUILD_LINE, "")
    .replace(BACKUP_SCRIPT_LINE, (_line, indent: string) => inlineContent(indent, backupScript));
}

// Bloc YAML `content: |` ; `$` est doublé car Compose interpole aussi ce contenu.
function inlineContent(indent: string, text: string): string {
  const body = text
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => (line === "" ? "" : `${indent}  ${line.replaceAll("$", "$$$$")}`))
    .join("\n");
  return `${indent}content: |\n${body}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tag, path = "docker-compose.yml"] = process.argv.slice(2);
  if (!tag) throw new Error("Usage : release-compose.ts <tag> [docker-compose.yml]");
  const backupScript = readFileSync(new URL(`../../${BACKUP_SCRIPT_PATH}`, import.meta.url), "utf8");
  process.stdout.write(releaseCompose(readFileSync(path, "utf8"), tag, backupScript));
}
