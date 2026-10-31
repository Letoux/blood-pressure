import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "@/server/testing/test-api";

/**
 * La suppression d'un utilisateur par l'admin supprime toutes ses données (mesures, campagnes,
 * réglages, abonnements push…). Elle repose sur la base : toute table qui référence `user`
 * doit le faire avec `on delete cascade`. Ce test le vérifie pour toutes les migrations.
 */
describe("données d'un utilisateur", () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });

  afterAll(async () => {
    await api.close();
  });

  it("toute clé étrangère vers un utilisateur est supprimée en cascade avec lui", async () => {
    const result = await api.db.execute<{ table_name: string; delete_rule: string }>(sql`
      select tc.table_name, rc.delete_rule
      from information_schema.referential_constraints rc
      join information_schema.table_constraints tc on tc.constraint_name = rc.constraint_name
        and tc.constraint_schema = rc.constraint_schema
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name
        and ccu.constraint_schema = rc.unique_constraint_schema
      where ccu.table_name = 'user' and tc.constraint_schema = 'public'
    `);

    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.delete_rule, row.table_name).toBe("CASCADE");
    }
  });
});
