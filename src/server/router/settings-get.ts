import { eq } from "drizzle-orm";
import { FREQUENCY_MONTHS } from "@/domain/campaign";
import { DEFAULT_GUIDELINE } from "@/domain/guideline";
import { reminderPreferencesOf } from "@/domain/reminder";
import type { Db } from "@/server/db/client";
import { user, userSettings } from "@/server/db/schema";
import { DEFAULT_THEME } from "@/lib/theme";
import { authed } from "./authed";

/**
 * Réglages d'un utilisateur : nom affiché, langue (`null` : celle du navigateur), thème, fuseau
 * (`null` : pas encore détecté depuis le navigateur), fréquence des campagnes, référentiel,
 * préférences de rappel et premier lancement vu. Sans ligne `user_settings`, les valeurs par
 * défaut. Aucun n'est une donnée de santé : l'admin règle aussi les siens (`ADMIN_ALLOWED` de
 * `access.int.test.ts`).
 */
export async function readSettings(db: Db, userId: string) {
  const [row] = await db
    .select({
      name: user.name,
      locale: userSettings.locale,
      theme: userSettings.theme,
      timeZone: userSettings.timeZone,
      frequencyMonths: userSettings.frequencyMonths,
      morningTime: userSettings.morningTime,
      eveningTime: userSettings.eveningTime,
      dayBeforeReminder: userSettings.dayBeforeReminder,
      followUpEnabled: userSettings.followUpEnabled,
      followUpDelayMinutes: userSettings.followUpDelayMinutes,
      onboarded: userSettings.onboarded,
      guideline: userSettings.guideline,
    })
    .from(user)
    .leftJoin(userSettings, eq(userSettings.userId, user.id))
    .where(eq(user.id, userId));
  if (!row) throw new Error(`utilisateur ${userId} introuvable`);
  return {
    name: row.name,
    locale: row.locale ?? null,
    theme: row.theme ?? DEFAULT_THEME,
    timeZone: row.timeZone ?? null,
    frequencyMonths: row.frequencyMonths ?? FREQUENCY_MONTHS.default,
    ...reminderPreferencesOf(row),
    onboarded: row.onboarded ?? false,
    guideline: row.guideline ?? DEFAULT_GUIDELINE,
  };
}

/** Les réglages de l'appelant. */
export const settingsGet = authed.handler(({ context }) => readSettings(context.db, context.user.id));
