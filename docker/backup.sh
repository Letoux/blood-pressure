#!/bin/sh
# Sauvegarde quotidienne de la base (service `backup` du compose).
#   backup.sh       : boucle, un dump par jour à BACKUP_TIME, puis purge ;
#   backup.sh once  : un dump et une purge immédiats.
# Connexion Postgres par les variables libpq (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
# Restauration : voir le README (`pg_restore`).
set -eu
# Les dumps contiennent des données de santé : lisibles par leur seul propriétaire.
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

case "$BACKUP_RETENTION_DAYS" in
  *[!0-9]* | 0*)
    echo "BACKUP_RETENTION_DAYS invalide : « $BACKUP_RETENTION_DAYS » (attendu un nombre de jours ≥ 1)" >&2
    exit 1
    ;;
esac

log() { echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Dump au format custom de pg_dump (compressé, restaurable avec pg_restore).
# Il est écrit dans un fichier temporaire, renommé seulement en cas de succès :
# un dump interrompu ne passe jamais pour une sauvegarde valide.
dump() {
  name="${PGDATABASE}-$(date +%Y-%m-%d_%H%M%S).dump"
  tmp="$BACKUP_DIR/.$name.partial"
  if pg_dump --format=custom --file="$tmp"; then
    mv "$tmp" "$BACKUP_DIR/$name"
    log "dump écrit : $name"
  else
    rm -f "$tmp"
    log "échec du dump, aucune purge"
    return 1
  fi
}

# Supprime les dumps vieux d'au moins BACKUP_RETENTION_DAYS jours
# (un dump par jour : on garde les BACKUP_RETENTION_DAYS derniers).
prune() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' \
    -mtime +"$((BACKUP_RETENTION_DAYS - 1))" -print -exec rm -f {} + |
    while read -r old; do log "purgé : ${old##*/}"; done
}

backup() {
  dump && prune
}

# Nombre décimal sans zéro en tête (« 08 » serait lu en octal par $(( ))).
dec() {
  n="${1#0}"
  echo "${n:-0}"
}

# Secondes entre l'heure courante (HH:MM:SS) et la prochaine occurrence de
# l'heure du dump (HH:MM). Jamais 0 : à l'heure pile, le prochain dump est demain.
# Calcul à heure locale fixe : un jour de changement d'heure, le dump peut
# décaler d'une heure, ce qui est sans conséquence.
seconds_until() {
  case "$1" in
    [01][0-9]:[0-5][0-9] | 2[0-3]:[0-5][0-9]) ;;
    *)
      echo "BACKUP_TIME invalide : « $1 » (attendu HH:MM, de 00:00 à 23:59)" >&2
      return 1
      ;;
  esac
  target=$(($(dec "${1%%:*}") * 3600 + $(dec "${1#*:}") * 60))
  IFS=: read -r h m s <<EOF
$2
EOF
  now=$(($(dec "$h") * 3600 + $(dec "$m") * 60 + $(dec "$s")))
  delta=$(((target - now + 86400) % 86400))
  [ "$delta" -eq 0 ] && delta=86400
  echo "$delta"
}

run() {
  BACKUP_TIME="${BACKUP_TIME:-03:00}"
  seconds_until "$BACKUP_TIME" 00:00:00 >/dev/null
  log "dump quotidien à $BACKUP_TIME (TZ=${TZ:-UTC}), rétention $BACKUP_RETENTION_DAYS jours, dans $BACKUP_DIR"
  while :; do
    sleep "$(seconds_until "$BACKUP_TIME" "$(date +%H:%M:%S)")"
    # Un échec est journalisé ; on réessaie au prochain créneau.
    backup || true
  done
}

case "${1:-run}" in
  run) run ;;
  once) backup ;;
  delay) seconds_until "$2" "$3" ;;
  *)
    echo "usage : backup.sh [run | once | delay HH:MM HH:MM:SS]" >&2
    exit 2
    ;;
esac
