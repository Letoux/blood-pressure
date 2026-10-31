# blood-pressure

Suivi de l'automesure tensionnelle (règle du 3-3-3), PWA auto-hébergée. Le vocabulaire du domaine est dans `GLOSSARY.md`, les décisions dans `docs/adr/`, et leur contexte historique dans `docs/HISTORIQUE.md`.

## Conventions

- **Arborescence** : `src/app/` (pages Next.js et route `/rpc`), `src/server/router/` (une procédure oRPC par fichier, regroupées dans `index.ts`), `src/server/db/` (schéma Drizzle et connexion), `src/worker/` (service `worker`), `src/lib/` (code client), `drizzle/` (migrations SQL commitées), `e2e/` (Playwright). Le domaine pur ira dans `src/domain/`, sans import de base ni de framework.
- **API** : toute donnée passe par le routeur oRPC (`src/server/router`), consommé côté client avec `orpc.<procédure>.queryOptions()` (TanStack Query). Les procédures partent de `base` (`router/base.ts`) et reçoivent leurs dépendances par le contexte (`AppContext`), jamais par un import global : c'est ce qui les rend testables.
- **Base** : modifier `src/server/db/schema.ts`, puis `pnpm db:generate` et committer la migration. Les migrations s'appliquent au démarrage du conteneur `app` (`docker/entrypoint.sh`).
- **Tests** (voir les points d'entrée validés) :
  - domaine pur : `*.test.ts` à côté du code, `pnpm test` ;
  - routeur oRPC contre un vrai Postgres : `*.int.test.ts`, `pnpm test:int`, via `createTestApi()` (`src/server/testing/test-api.ts`), qui crée une base jetable migrée par suite et appelle le routeur côté serveur. Il faut un Postgres joignable par `TEST_DATABASE_URL` (défaut `postgres://postgres:postgres@localhost:5432/postgres`), par exemple `docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17-alpine` ;
  - Playwright : `e2e/*.spec.ts`, `pnpm test:e2e` avec `DATABASE_URL` défini, uniquement pour les parcours clés.
- **Vérifications** avant de committer : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:int`. La CI (`.github/workflows/ci.yml`) lance aussi Playwright, le build de l'image et gitleaks.
- **Déploiement** : une seule image (`Dockerfile`), commande `app` (migrations puis serveur Next.js standalone) ou `worker`. `docker-compose.yml` lance `app`, `worker` et `db`. Toute nouvelle variable d'environnement est documentée dans `.env.template`. Un tag `vX.Y.Z` lance `.github/workflows/release.yml` : image amd64 et arm64 sur `ghcr.io/letoux/blood-pressure` (tags `vX.Y.Z`, `X.Y`, `latest`), puis une GitHub Release avec le compose épinglé sur cette image (généré par `src/scripts/release-compose.ts`, qui échoue si le compose ne contient plus `image: ${IMAGE:-…:latest}` et `build: .`) et le `.env.template` (joint sous le nom `env.template`). **Repo public** : jamais de secret ni de `.env` commité.

## Agent skills

### Issue tracker

Les issues et les specs sont des GitHub Issues de `Letoux/blood-pressure` (via `gh`). Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq labels canoniques par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.

### Domain docs

Un seul contexte : `GLOSSARY.md` et `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
