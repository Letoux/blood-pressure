# blood-pressure

Suivi de l'automesure tensionnelle (règle du 3-3-3) : une PWA auto-hébergée pour un foyer et ses proches. Elle n'est pas faite pour être un service public (voir [ADR-0001](docs/adr/0001-auto-hebergement-familial.md)).

L'application tourne avec `docker compose`, derrière un reverse proxy qui gère le HTTPS. Ce guide suppose **Nginx Proxy Manager**. Le compose lance quatre services :

| Service  | Rôle                                                                  |
| -------- | --------------------------------------------------------------------- |
| `app`    | l'application web (applique les migrations de la base au démarrage)   |
| `worker` | les tâches de fond (rappels push)                                     |
| `db`     | Postgres, dans le volume Docker `db-data`                             |
| `backup` | un dump quotidien de la base dans un dossier de l'hôte                |

## Installation

Prérequis : Docker avec le plugin Compose 2.23.1 ou plus récent (`docker compose version`), et un nom de domaine qui pointe vers votre Nginx Proxy Manager.

1. Récupérez les fichiers, au choix :
   - **depuis une release** (recommandé) : sur la page [Releases](https://github.com/Letoux/blood-pressure/releases), téléchargez `docker-compose.yml` et `env.template` dans un même dossier, puis `mv env.template .env`. Ce compose est épinglé sur l'image de la version ;
   - **depuis le dépôt** : `git clone https://github.com/Letoux/blood-pressure.git && cd blood-pressure && cp .env.template .env`. Ce compose suit l'image `latest`.
2. Remplissez `.env`. Chaque variable y est commentée. Au minimum :
   - `APP_URL` : l'adresse publique en `https://`, sans slash final (par exemple `https://tension.example.org`) ;
   - `POSTGRES_PASSWORD` : un mot de passe long, uniquement avec des caractères sûrs dans une URL (`openssl rand -hex 24`) ;
   - `ADMIN_EMAIL` et `ADMIN_PASSWORD` (10 caractères minimum) : le compte admin, qui gère les comptes mais n'a jamais accès aux mesures ([ADR-0004](docs/adr/0004-admin-hors-donnees-de-sante.md)) ;
   - `BETTER_AUTH_SECRET` : la clé de signature des sessions, 32 caractères minimum (`openssl rand -hex 32`).

   L'app refuse de démarrer si `ADMIN_PASSWORD` ou `BETTER_AUTH_SECRET` valent encore l'exemple du template (`remplacer-…`).
3. Lancez :

   ```sh
   docker compose up -d
   docker compose ps   # `app` doit passer à « healthy »
   ```

L'application écoute sur le port `APP_PORT` de l'hôte (3000 par défaut), en HTTP. Ne l'exposez pas directement sur Internet : passez par le reverse proxy.

> `.env` contient des secrets. Ne le committez jamais et ne le partagez pas.

## HTTPS avec Nginx Proxy Manager

Le HTTPS n'est pas optionnel : sans lui, le navigateur refuse le service worker. Il n'y a alors **ni notifications push (Web Push) ni installation de la PWA** sur l'écran d'accueil. Sur iPhone, les notifications exigent en plus que la PWA soit installée (iOS 16.4 ou plus).

Dans Nginx Proxy Manager, **Hosts → Proxy Hosts → Add Proxy Host** :

- onglet **Details** :
  - *Domain Names* : votre domaine, par exemple `tension.example.org` ;
  - *Scheme* : `http` ;
  - *Forward Hostname / IP* : l'adresse IP de la machine qui fait tourner le compose, vue depuis Nginx Proxy Manager (son IP sur le réseau local, par exemple) ;
  - *Forward Port* : la valeur de `APP_PORT` (3000 par défaut) ;
  - cochez *Block Common Exploits* ;
- onglet **SSL** :
  - *SSL Certificate* : *Request a new SSL Certificate* (Let's Encrypt). Le domaine doit pointer vers Nginx Proxy Manager, et les ports 80 et 443 doivent lui parvenir pour la validation. Sinon, utilisez un *DNS Challenge* ;
  - cochez *Force SSL* et *HTTP/2 Support*. *HSTS* est conseillé, une fois que tout fonctionne.

Vérifiez ensuite que `APP_URL` dans `.env` est **exactement** l'adresse servie par le proxy (`https://tension.example.org`, sans slash final). Si vous la modifiez, appliquez le changement avec `docker compose up -d`.

Test : `https://tension.example.org/health` doit répondre, avec un cadenas valide dans le navigateur.

## Sauvegardes

Le service `backup` fait chaque jour un `pg_dump` de la base. Le dump est au format custom de Postgres, déjà compressé, et se restaure avec `pg_restore`. Il est écrit dans le dossier `BACKUP_DIR` de l'hôte (`./backups` par défaut, à côté du `docker-compose.yml`) sous le nom `<base>-AAAA-MM-JJ_HHMMSS.dump`. Après chaque dump réussi, les dumps de `BACKUP_RETENTION_DAYS` jours ou plus sont supprimés. Si un dump échoue, rien n'est supprimé.

Réglages dans `.env` :

| Variable                | Défaut         | Rôle                                                  |
| ----------------------- | -------------- | ----------------------------------------------------- |
| `BACKUP_DIR`            | `./backups`    | dossier de l'hôte qui reçoit les dumps                |
| `BACKUP_TIME`           | `03:00`        | heure du dump quotidien (`HH:MM`)                     |
| `BACKUP_TZ`             | `Europe/Paris` | fuseau de `BACKUP_TIME`                               |
| `BACKUP_RETENTION_DAYS` | `14`           | nombre de jours de dumps conservés (1 ou plus)        |

Après un changement, lancez `docker compose up -d`. Le journal du service confirme les réglages et chaque dump : `docker compose logs backup`.

Pour faire un dump tout de suite (avant une mise à jour par exemple) :

```sh
docker compose exec backup sh /usr/local/bin/backup.sh once
```

Les dumps contiennent des données de santé. Ils appartiennent à `root` et ne sont lisibles que par lui (droits `600`). Ils restent sur la même machine que la base : copiez régulièrement `BACKUP_DIR` ailleurs (un autre disque, une autre machine).

## Restaurer une sauvegarde

La restauration **remplace** tout le contenu de la base (comptes, mesures, campagnes, réglages) par celui du dump.

```sh
# 1. Choisir le dump
sudo ls -l backups/

# 2. Arrêter l'application et le worker (la base reste démarrée)
docker compose stop app worker

# 3. Restaurer, en une seule transaction : en cas d'erreur, rien n'est modifié
sudo cat backups/bloodpressure-2026-10-30_030000.dump \
  | docker compose exec -T db sh -c \
    'pg_restore --clean --if-exists --no-owner --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# 4. Redémarrer
docker compose start app worker
```

Remplacez le nom du dump par le vôtre, et `backups/` par votre `BACKUP_DIR` s'il est différent. Vérifiez ensuite dans l'application que les dernières mesures attendues sont bien là.

Pour restaurer sur une **nouvelle machine** : installez l'application comme ci-dessus avec les mêmes valeurs de `POSTGRES_*` dans `.env`, lancez `docker compose up -d` une première fois, copiez le dump dans `backups/`, puis suivez les étapes 2 à 4.

## Mettre à jour

Les migrations de la base s'appliquent toutes seules au démarrage de `app`. Faites quand même un dump juste avant (voir [Sauvegardes](#sauvegardes)), pour pouvoir revenir en arrière.

**Installation depuis une release** :

1. Téléchargez le `docker-compose.yml` de la nouvelle release et remplacez l'ancien. **Gardez votre `.env`.**
2. Comparez votre `.env` avec le nouveau `env.template` et ajoutez les variables nouvelles s'il y en a.
3. Lancez :

   ```sh
   docker compose pull
   docker compose up -d
   ```

**Installation depuis le dépôt** :

```sh
git pull
docker compose pull
docker compose up -d
```

Comparez aussi `.env` avec `.env.template` après le `git pull`.

Dans les deux cas, `docker compose ps` doit montrer `app` en « healthy », et `docker compose logs app` les migrations appliquées. Pour revenir à la version précédente : remettez l'ancien `docker-compose.yml` (ou `git checkout` l'ancien tag), puis restaurez le dump fait avant la mise à jour.

Pour faire le ménage dans les anciennes images : `docker image prune`.

## Développement

Les conventions, l'arborescence et les commandes de test sont dans [CLAUDE.md](CLAUDE.md). Le vocabulaire du domaine est dans [GLOSSARY.md](GLOSSARY.md), les décisions dans [docs/adr/](docs/adr/) et leur contexte dans [docs/HISTORIQUE.md](docs/HISTORIQUE.md).
