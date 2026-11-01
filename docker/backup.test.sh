#!/bin/sh
# Tests du script de sauvegarde (`docker/backup.sh`), sans Docker ni Postgres :
# `pg_dump` est remplacé par un faux programme placé en tête du PATH.
# Lancement : `pnpm test:backup` (ou `sh docker/backup.test.sh`).
set -eu

SCRIPT="$(cd "$(dirname "$0")" && pwd)/backup.sh"
failures=0
work=""

setup() {
  work="$(mktemp -d)"
  mkdir -p "$work/bin" "$work/backups"
  # Faux pg_dump : écrit ses arguments dans le fichier demandé par --file.
  # Avec FAKE_PG_DUMP_FAIL=1, il laisse un fichier partiel et échoue.
  cat >"$work/bin/pg_dump" <<'EOF'
#!/bin/sh
for arg in "$@"; do
  case "$arg" in --file=*) out="${arg#--file=}" ;; esac
done
if [ "${FAKE_PG_DUMP_FAIL:-0}" = 1 ]; then
  echo "partiel" >"$out"
  echo "pg_dump: connexion perdue" >&2
  exit 1
fi
echo "dump $*" >"$out"
EOF
  chmod +x "$work/bin/pg_dump"
}

teardown() { rm -rf "$work"; }

run_once() {
  PATH="$work/bin:$PATH" BACKUP_DIR="$work/backups" PGDATABASE=bloodpressure \
    sh "$SCRIPT" once >"$work/out.log" 2>&1 && status=0 || status=$?
}

# Crée un dump factice daté d'il y a $2 jours (date de modification).
old_dump() {
  touch -d "@$(($(date +%s) - $2 * 86400 - 60))" "$work/backups/$1"
}

check() {
  # check <description> <commande...>
  desc="$1"; shift
  if "$@"; then
    echo "ok   - $desc"
  else
    echo "FAIL - $desc"
    [ -f "$work/out.log" ] && sed 's/^/       /' "$work/out.log"
    failures=$((failures + 1))
  fi
}

# --- Un dump horodaté par exécution ---------------------------------------
setup
run_once
check "once se termine sans erreur" [ "$status" -eq 0 ]
dumps="$(ls "$work/backups")"
check "once produit un seul dump" [ "$(echo "$dumps" | wc -l)" -eq 1 ]
check "le dump est nommé <base>-AAAA-MM-JJ_HHMMSS.dump" \
  sh -c "echo '$dumps' | grep -Eq '^bloodpressure-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}\.dump$'"
check "le dump porte la date du jour" \
  sh -c "echo '$dumps' | grep -q \"^bloodpressure-$(date +%Y-%m-%d)_\""
check "pg_dump est appelé au format custom" \
  grep -q -- "--format=custom" "$work/backups/$dumps"
check "pg_dump exclut le schéma de pg-boss (ses partitions bloquent pg_restore --clean)" \
  grep -q -- "--exclude-schema=pgboss" "$work/backups/$dumps"
check "le dump n'est lisible que par son propriétaire (données de santé)" \
  [ "$(stat -c %a "$work/backups/$dumps")" = 600 ]
teardown

# --- Rétention : 14 jours par défaut --------------------------------------
setup
old_dump bloodpressure-old-20.dump 20
old_dump bloodpressure-old-14.dump 14
old_dump bloodpressure-old-13.dump 13
old_dump notes.txt 30
run_once
check "un dump de 20 jours est supprimé" [ ! -e "$work/backups/bloodpressure-old-20.dump" ]
check "un dump de 14 jours est supprimé" [ ! -e "$work/backups/bloodpressure-old-14.dump" ]
check "un dump de 13 jours est conservé" [ -e "$work/backups/bloodpressure-old-13.dump" ]
check "un fichier qui n'est pas un dump n'est jamais supprimé" [ -e "$work/backups/notes.txt" ]
teardown

# --- Rétention configurable ------------------------------------------------
setup
old_dump bloodpressure-old-5.dump 5
old_dump bloodpressure-old-2.dump 2
BACKUP_RETENTION_DAYS=3 run_once
check "BACKUP_RETENTION_DAYS=3 supprime un dump de 5 jours" [ ! -e "$work/backups/bloodpressure-old-5.dump" ]
check "BACKUP_RETENTION_DAYS=3 conserve un dump de 2 jours" [ -e "$work/backups/bloodpressure-old-2.dump" ]
teardown

# --- Rétention invalide : refusée avant tout dump ---------------------------
for bad in 0 abc -3; do
  setup
  BACKUP_RETENTION_DAYS="$bad" run_once
  check "BACKUP_RETENTION_DAYS=« $bad » est refusé" [ "$status" -ne 0 ]
  check "BACKUP_RETENTION_DAYS=« $bad » : aucun dump" [ -z "$(ls "$work/backups")" ]
  teardown
done

# --- Échec du dump : pas de purge, pas de dump partiel ---------------------
setup
old_dump bloodpressure-old-20.dump 20
FAKE_PG_DUMP_FAIL=1 run_once
check "once échoue si pg_dump échoue" [ "$status" -ne 0 ]
check "rien n'est purgé si le dump échoue" [ -e "$work/backups/bloodpressure-old-20.dump" ]
check "aucun dump partiel ne reste" [ "$(ls "$work/backups" | wc -l)" -eq 1 ]
teardown

# --- Heure du dump : délai jusqu'à la prochaine exécution ------------------
delay() { sh "$SCRIPT" delay "$@" 2>/dev/null; }
check "03:00 à 02:59:00 : dans 60 s" [ "$(delay 03:00 02:59:00)" = 60 ]
check "03:00 à 03:00:01 : demain, dans 86399 s" [ "$(delay 03:00 03:00:01)" = 86399 ]
check "03:00 à 03:00:00 : demain, pas deux dumps de suite" [ "$(delay 03:00 03:00:00)" = 86400 ]
check "08:09 à 07:08:00 (zéros en tête) : dans 3660 s" [ "$(delay 08:09 07:08:00)" = 3660 ]
check "00:00 à 23:59:30 : dans 30 s" [ "$(delay 00:00 23:59:30)" = 30 ]
check "BACKUP_TIME=25:00 est refusé" sh -c "! sh '$SCRIPT' delay 25:00 01:00:00 2>/dev/null"
check "BACKUP_TIME=3h est refusé" sh -c "! sh '$SCRIPT' delay 3h 01:00:00 2>/dev/null"

summary() {
  if [ "$failures" -gt 0 ]; then
    echo "$failures test(s) en échec"
    exit 1
  fi
  echo "tous les tests passent"
}
summary
