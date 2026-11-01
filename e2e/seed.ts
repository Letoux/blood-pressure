import { Client } from "pg";

// Données de test écrites directement en base (`DATABASE_URL`, la base de l'app E2E) : une
// campagne terminée a forcément des dates passées, que l'interface ne permet pas de planifier.

type Values = { systolic: number; diastolic: number };

/** Le jour UTC d'il y a `days` jours (`2026-02-03`). */
export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function withDb<T>(run: (db: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis pour les tests E2E.");
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

async function userId(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [email]);
  if (!rows[0]) throw new Error(`utilisateur ${email} introuvable`);
  return rows[0].id;
}

/**
 * Une campagne commencée le jour `start`, avec ses `count` premières mesures (au plus 18) à
 * `values` : 3 par créneau, le matin à 7 h UTC et le soir à 19 h UTC.
 */
export function seedCampaign(email: string, start: string, count: number, values: Values) {
  return withDb(async (db) => {
    const owner = await userId(db, email);
    const { rows } = await db.query<{ id: string }>(
      "insert into campaign (user_id, planned_start) values ($1, $2) returning id",
      [owner, start],
    );
    const campaignId = rows[0]!.id;
    let inserted = 0;
    for (const day of [1, 2, 3]) {
      for (const moment of ["morning", "evening"]) {
        for (let i = 0; i < 3 && inserted < count; i += 1, inserted += 1) {
          const takenAt = new Date(`${start}T${moment === "morning" ? "07" : "19"}:0${i}:00Z`);
          takenAt.setUTCDate(takenAt.getUTCDate() + day - 1);
          await db.query(
            `insert into measurement (user_id, taken_at, systolic, diastolic, pulse, moment, campaign_id, campaign_day)
             values ($1, $2, $3, $4, 70, $5, $6, $7)`,
            [owner, takenAt, values.systolic, values.diastolic, moment, campaignId, day],
          );
        }
      }
    }
  });
}

/** Une campagne prévue le jour `plannedStart`, sans mesure (en retard ou manquée si ce jour est passé). */
export function seedPlannedCampaign(email: string, plannedStart: string) {
  return withDb(async (db) => {
    await db.query("insert into campaign (user_id, planned_start) values ($1, $2)", [
      await userId(db, email),
      plannedStart,
    ]);
  });
}

/** Une mesure libre le jour `date`, à midi UTC. */
export function seedFreeMeasurement(email: string, date: string, values: Values) {
  return withDb(async (db) => {
    await db.query(
      `insert into measurement (user_id, taken_at, systolic, diastolic, pulse, moment)
       values ($1, $2, $3, $4, 70, 'evening')`,
      [await userId(db, email), new Date(`${date}T12:00:00Z`), values.systolic, values.diastolic],
    );
  });
}
