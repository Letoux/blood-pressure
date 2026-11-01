import { sql } from "drizzle-orm";
import { base } from "./base";

export const health = base.handler(async ({ context }) => {
  await context.db.execute(sql`select 1`);
  return { status: "ok" as const };
});
