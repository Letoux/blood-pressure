// Point d'entrée du service `worker` (même image que `app`, commande `worker`, ADR-0003).
// pg-boss, sur la même base Postgres (schéma `pgboss`, créé et migré par pg-boss lui-même), lance
// la tâche des rappels chaque minute ; les migrations de l'app sont appliquées par le service
// `app`, que le compose attend avant de démarrer le worker.
import { PgBoss } from "pg-boss";
import { closeDb, getDb } from "@/server/db";
import { serverEnv } from "@/server/env";
import { getPushSender } from "@/server/push";
import { runMissedCampaigns } from "./missed-campaigns";
import { runReminders } from "./reminders";

const REMINDERS_QUEUE = "reminders";
const MISSED_CAMPAIGNS_QUEUE = "missed-campaigns";

const db = getDb();
// Lit `APP_URL` tout de suite : une configuration manquante arrête le worker dès le démarrage.
const sender = getPushSender();

const boss = new PgBoss({ connectionString: serverEnv().DATABASE_URL, application_name: "blood-pressure-worker" });
boss.on("error", (error) => console.error("[worker] pg-boss", error));

await boss.start();
// Une seule tâche active à la fois (`singleton`), sans nouvel essai : la minute suivante reprend
// ce qui est encore dû. Pour les minutes où le worker était arrêté, pg-boss ne rattrape rien
// (`missed: "skip"`) ; le domaine envoie encore un rappel en retard de moins de
// `REMINDER_GRACE_MINUTES`.
await boss.createQueue(REMINDERS_QUEUE, { policy: "singleton", retryLimit: 0, expireInSeconds: 120 });
await boss.schedule(REMINDERS_QUEUE, "* * * * *", null, { tz: "UTC", missed: "skip" });
await boss.work(REMINDERS_QUEUE, async () => {
  const report = await runReminders({ db, sender, now: new Date() });
  if (report.reminders > 0 || report.removed > 0 || report.failed > 0) {
    console.log(
      `[worker] rappels : ${report.reminders} envoyé(s), ${report.sent} appareil(s) atteint(s), ` +
        `${report.removed} abonnement(s) expiré(s) supprimé(s), ${report.failed} échec(s)`,
    );
  }
});
// Statut « manquée » enregistré en base (ADR-0011). Le domaine le calcule déjà sans attendre
// cette tâche : un passage par quart d'heure suffit.
await boss.createQueue(MISSED_CAMPAIGNS_QUEUE, { policy: "singleton", retryLimit: 0, expireInSeconds: 600 });
await boss.schedule(MISSED_CAMPAIGNS_QUEUE, "*/15 * * * *", null, { tz: "UTC", missed: "skip" });
await boss.work(MISSED_CAMPAIGNS_QUEUE, async () => {
  const recorded = await runMissedCampaigns({ db, now: new Date() });
  if (recorded > 0) console.log(`[worker] ${recorded} campagne(s) manquée(s) enregistrée(s)`);
});
console.log("[worker] démarré : rappels chaque minute, campagnes manquées chaque quart d'heure");

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] arrêt (${signal}) : fin de la tâche en cours`);
    try {
      // Attend la fin de la tâche en cours (au plus 20 s), sous le délai de `docker stop`.
      await boss.stop({ graceful: true, timeout: 20_000 });
      await closeDb();
      console.log("[worker] arrêté");
      process.exit(0);
    } catch (error) {
      console.error("[worker] arrêt en erreur", error);
      process.exit(1);
    }
  });
}
