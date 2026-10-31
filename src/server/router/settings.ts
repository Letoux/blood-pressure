import { eq } from "drizzle-orm";
import { z } from "zod";
import { FREQUENCY_MONTHS } from "@/domain/campaign";
import { DEFAULT_GUIDELINE, GUIDELINE_IDS } from "@/domain/guideline";
import { isTimeZone } from "@/domain/local-date";
import { FOLLOW_UP_DELAY_MINUTES, isTimeOfDay, REMINDER_DEFAULTS, type TimeOfDay } from "@/domain/reminder";
import { LOCALES } from "@/i18n/locale";
import type { Db } from "@/server/db/client";
import { user, userSettings } from "@/server/db/schema";
import { DEFAULT_THEME, THEMES } from "@/lib/theme";
import { authed } from "./authed";

/**
 * Réglages de l'appelant : nom affiché, langue (`null` : celle du navigateur), thème, fuseau
 * (`null` : pas encore détecté depuis le navigateur), fréquence des campagnes, préférences de
 * rappel et premier lancement vu. Aucun n'est une donnée de santé : l'admin règle aussi les siens
 * (`ADMIN_ALLOWED` de `access.int.test.ts`).
 * (`null` : pas encore détecté depuis le navigateur), fréquence des campagnes et référentiel.
 * Aucun n'est une donnée de santé : l'admin règle aussi les siens (`ADMIN_ALLOWED` de
 * `access.int.test.ts`).
 */
async function readSettings(db: Db, userId: string) {
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
    morningTime: (row.morningTime ?? REMINDER_DEFAULTS.morningTime) as TimeOfDay,
    eveningTime: (row.eveningTime ?? REMINDER_DEFAULTS.eveningTime) as TimeOfDay,
    dayBeforeReminder: row.dayBeforeReminder ?? REMINDER_DEFAULTS.dayBeforeReminder,
    followUpEnabled: row.followUpEnabled ?? REMINDER_DEFAULTS.followUpEnabled,
    followUpDelayMinutes: row.followUpDelayMinutes ?? REMINDER_DEFAULTS.followUpDelayMinutes,
    onboarded: row.onboarded ?? false,
    guideline: row.guideline ?? DEFAULT_GUIDELINE,
  };
}

const timeOfDay = z.string().refine(isTimeOfDay, "Heure invalide (HH:MM attendu).");

/** Les réglages de l'appelant. */
export const settingsGet = authed.handler(({ context }) => readSettings(context.db, context.user.id));

/** Met à jour les réglages fournis, sans toucher aux autres. */
export const settingsUpdate = authed
  .input(
    z.object({
      name: z.string().trim().min(1).max(100).optional(),
      locale: z.enum(LOCALES).optional(),
      theme: z.enum(THEMES).optional(),
      timeZone: z.string().refine(isTimeZone, "Fuseau horaire inconnu.").optional(),
      frequencyMonths: z.number().int().min(FREQUENCY_MONTHS.min).max(FREQUENCY_MONTHS.max).optional(),
      morningTime: timeOfDay.optional(),
      eveningTime: timeOfDay.optional(),
      dayBeforeReminder: z.boolean().optional(),
      followUpEnabled: z.boolean().optional(),
      followUpDelayMinutes: z
        .number()
        .int()
        .min(FOLLOW_UP_DELAY_MINUTES.min)
        .max(FOLLOW_UP_DELAY_MINUTES.max)
        .optional(),
      onboarded: z.boolean().optional(),
      guideline: z.enum(GUIDELINE_IDS).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const userId = context.user.id;
    const { name, ...preferences } = input;
    await context.db.transaction(async (tx) => {
      if (name !== undefined) {
        await tx.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId));
      }
      if (Object.keys(preferences).length > 0) {
        await tx
          .insert(userSettings)
          .values({ userId, ...preferences })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: { ...preferences, updatedAt: new Date() },
          });
      }
    });
    return readSettings(context.db, userId);
  });
