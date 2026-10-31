// Produit le `docker-compose.yml` joint à chaque GitHub Release : celui du dépôt,
// mais épinglé sur l'image publiée pour le tag et sans build local.
// Usage (Node 24, sans dépendance) : `node src/scripts/release-compose.ts v1.2.3 > docker-compose.yml`
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const IMAGE_REPOSITORY = "ghcr.io/letoux/blood-pressure";

const IMAGE_LINE = /^(\s*)image: \$\{IMAGE:-ghcr\.io\/letoux\/blood-pressure:latest\}$/m;
const BUILD_LINE = /^\s*build: \.\n/m;

export function releaseCompose(source: string, tag: string): string {
  if (!IMAGE_LINE.test(source) || !BUILD_LINE.test(source)) {
    throw new Error(
      "docker-compose.yml : ligne `image: ${IMAGE:-…:latest}` ou `build: .` introuvable, adapter release-compose.ts",
    );
  }
  return source
    .replace(IMAGE_LINE, `$1image: ${IMAGE_REPOSITORY}:${tag}`)
    .replace(BUILD_LINE, "");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tag, path = "docker-compose.yml"] = process.argv.slice(2);
  if (!tag) throw new Error("Usage : release-compose.ts <tag> [docker-compose.yml]");
  process.stdout.write(releaseCompose(readFileSync(path, "utf8"), tag));
}
