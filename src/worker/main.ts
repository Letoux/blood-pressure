// Point d'entrée du service `worker` (même image que `app`, ADR-0003).
// Pour l'instant une boucle vide : les tâches pg-boss (rappels) arrivent avec les tickets suivants.
console.log("[worker] démarré");

const keepAlive = setInterval(() => {}, 60_000);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    clearInterval(keepAlive);
    console.log(`[worker] arrêt (${signal})`);
    process.exit(0);
  });
}
