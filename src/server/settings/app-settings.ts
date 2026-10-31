import type { Db } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";

/** Réglages de l'instance, modifiés par l'admin. */
export type AppSettings = { signUpOpen: boolean };

const DEFAULTS: AppSettings = { signUpOpen: false };

export async function getAppSettings(db: Db): Promise<AppSettings> {
  const [row] = await db.select({ signUpOpen: appSettings.signUpOpen }).from(appSettings).limit(1);
  return row ?? DEFAULTS;
}

export async function updateAppSettings(db: Db, changes: Partial<AppSettings>): Promise<AppSettings> {
  const [row] = await db
    .insert(appSettings)
    .values({ ...DEFAULTS, ...changes })
    .onConflictDoUpdate({ target: appSettings.id, set: { ...changes, updatedAt: new Date() } })
    .returning({ signUpOpen: appSettings.signUpOpen });
  return row!;
}
