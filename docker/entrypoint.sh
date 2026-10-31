#!/bin/sh
# Une seule image, deux commandes (ADR-0003) :
#   app    : applique les migrations Drizzle puis lance le serveur Next.js ;
#   worker : lance le worker (tâches de fond).
set -eu

case "${1:-app}" in
  app)
    node dist/scripts/migrate.mjs
    exec node server.js
    ;;
  worker)
    exec node dist/worker/main.mjs
    ;;
  *)
    exec "$@"
    ;;
esac
