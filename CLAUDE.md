# blood-pressure

Suivi de l'automesure tensionnelle (règle du 3-3-3), PWA auto-hébergée. Le vocabulaire du domaine est dans `GLOSSARY.md`, les décisions dans `docs/adr/`, et leur contexte historique dans `docs/HISTORIQUE.md`.

## Conventions

- **Arborescence** : `src/app/` (pages Next.js et route `/rpc` ; pages connectées dans le groupe `(app)/`, espace admin dans `admin/`), `src/components/` (coquille, navigation ; `ui/` : composants shadcn/ui), `src/i18n/` (langues et catalogues), `src/server/router/` (une procédure oRPC par fichier, regroupées dans `index.ts`), `src/server/db/` (schéma Drizzle et connexion), `src/worker/` (service `worker`), `src/lib/` (code client), `drizzle/` (migrations SQL commitées), `e2e/` (Playwright). Le domaine pur ira dans `src/domain/`, sans import de base ni de framework.
- **API** : toute donnée passe par le routeur oRPC (`src/server/router`), consommé côté client avec `orpc.<procédure>.queryOptions()` (TanStack Query). Les procédures partent de `base` (`router/base.ts`) et reçoivent leurs dépendances par le contexte (`AppContext`), jamais par un import global : c'est ce qui les rend testables.
- **Authentification** : better-auth (`src/server/auth/`), routes `/api/auth/...`. Une procédure protégée part de `authed` (appelant connecté, `context.user`) ou de `adminOnly` (`router/authed.ts`), jamais de `base`. L'admin vient du `.env` et est créé ou mis à jour au démarrage (`src/instrumentation.ts`). Pages serveur : `requireUser()`.
- **Textes de l'interface** : aucun texte en dur. Chaque texte a une clé dans `src/i18n/messages/fr.json` **et** `en.json` (mêmes clés, vérifié par `src/i18n/messages.test.ts` ; le français fait foi pour le typage des clés). Les termes suivent `GLOSSARY.md` : le terme français en FR, son nom anglais en EN (Mesure / Measurement, Compte rendu / Report…). Composant serveur : `await getTranslations("section")` ; composant client : `useTranslations("section")`. Un message d'erreur du serveur n'est pas affiché tel quel : le client traduit selon le `code` de l'`ORPCError`. Pas de langue dans l'URL : `src/i18n/request.ts` prend la langue des réglages de l'utilisateur, sinon celle du navigateur, sinon le français (`resolveLocale`).
- **Interface** : Tailwind v4 et shadcn/ui (`pnpm dlx shadcn@3 add <composant>`, puis vérifier que `cn` vient de `@/lib/utils`), icônes lucide, pensée mobile d'abord (utilisable à 360 px). Thème : `<html data-theme="light|dark|system">` rendu par le serveur depuis les réglages, couleurs choisies en CSS seul (`src/app/globals.css`, variante `dark:`) : pas de script, donc pas de flash. Une page connectée va sous `src/app/(app)/` (coquille `AppShell` : en-tête, déconnexion, barre de navigation en bas). Pour l'ajouter à la navigation : une entrée dans `src/components/nav-items.ts` (`userNav` ou `adminNav`) et son libellé `nav.<clé>` dans les deux catalogues ; une page pas encore construite rend `<ComingSoon />`. Les pages de l'admin vont sous `src/app/admin/` (layout réservé à l'admin, `requireAdmin()` aussi dans chaque page).
- **Réglages de l'utilisateur** : table `user_settings` (une ligne par utilisateur, créée au premier enregistrement ; sans ligne, valeurs par défaut), lue et écrite par `settings.get` et `settings.update`. Le nom affiché reste `user.name` (better-auth). Un nouveau réglage : une colonne avec une valeur par défaut, et un champ facultatif dans `settings.update`.
- **Base** : modifier `src/server/db/schema.ts`, puis `pnpm db:generate` et committer la migration. Les migrations s'appliquent au démarrage du conteneur `app` (`docker/entrypoint.sh`).
- **Tests** (voir les points d'entrée validés) :
  - domaine pur : `*.test.ts` à côté du code, `pnpm test` ;
  - routeur oRPC contre un vrai Postgres : `*.int.test.ts`, `pnpm test:int`, via `createTestApi()` (`src/server/testing/test-api.ts`), qui crée une base jetable migrée par suite et appelle le routeur côté serveur (`api.client` anonyme, `api.as(await api.signIn(email, mdp))` connecté, `ensureAdmin(api.auth, …)` pour l'admin). Il faut un Postgres joignable par `TEST_DATABASE_URL` (défaut `postgres://postgres:postgres@localhost:5432/postgres`), par exemple `docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17-alpine` ;
  - Playwright : `e2e/*.spec.ts`, `pnpm test:e2e` avec `DATABASE_URL` défini, uniquement pour les parcours clés.
- **Vérifications** avant de committer : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:int` (et `pnpm test:backup` si `docker/backup.sh` change). La CI (`.github/workflows/ci.yml`) lance aussi Playwright, le build de l'image et gitleaks.
- **Déploiement** : une seule image (`Dockerfile`), commande `app` (migrations puis serveur Next.js standalone) ou `worker`. `docker-compose.yml` lance `app`, `worker`, `db` et `backup` (image Postgres, dump quotidien par `docker/backup.sh`, testé sans Docker par `pnpm test:backup`). Toute nouvelle variable d'environnement est documentée dans `.env.template`. Un tag `vX.Y.Z` lance `.github/workflows/release.yml` : image amd64 et arm64 sur `ghcr.io/letoux/blood-pressure` (tags `vX.Y.Z`, `X.Y`, `latest`), puis une GitHub Release avec le compose épinglé sur cette image (généré par `src/scripts/release-compose.ts`, qui échoue si le compose ne contient plus `image: ${IMAGE:-…:latest}`, `build: .` et la config `file: ./docker/backup.sh`, ce script étant embarqué en ligne) et le `.env.template` (joint sous le nom `env.template`). **Repo public** : jamais de secret ni de `.env` commité.

## Agent skills

### Issue tracker

Les issues et les specs sont des GitHub Issues de `Letoux/blood-pressure` (via `gh`). Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq labels canoniques par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Voir `docs/agents/triage-labels.md`.

### Domain docs

Un seul contexte : `GLOSSARY.md` et `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
