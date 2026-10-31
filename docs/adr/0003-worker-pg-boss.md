# Rappels envoyés par un worker séparé, avec une file pg-boss dans Postgres

Les rappels push sont planifiés et envoyés par un service `worker` qui tourne sur la même image Docker que l'app, avec une autre commande. La file de tâches est pg-boss, stockée dans Postgres.

**Options écartées** : un cron dans le processus Next.js (fragile au redémarrage et à la mise à l'échelle), et BullMQ avec Redis (un service de plus à héberger pour un usage familial).

Les clés VAPID sont générées au premier démarrage et stockées en base, pour qu'il n'y ait rien à configurer dans le `.env`.
