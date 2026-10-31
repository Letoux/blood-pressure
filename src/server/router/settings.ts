import { eq } from "drizzle-orm";
import { z } from "zod";
import { FREQUENCY_MONTHS } from "@/domain/campaign";
import { isTimeZone } from "@/domain/local-date";
import { LOCALES } from "@/i18n/locale";
import type { Db } from "@/server/db/client";
import { user, userSettings } from "@/server/db/schema";
import { DEFAULT_THEME, THEMES } from "@/lib/theme";
import { authed } from "./authed";

/**
 * Réglages de l'appelant : nom affiché, langue (`null` : celle du navigateur), thème, fuseau
 * (`null` : pas encore détecté depuis le navigateur) et fréquence des campagnes. Aucun n'est une
 * donnée de santé : l'admin règle aussi les siens (`ADMIN_ALLOWED` de `access.int.test.ts`).
 */
async function readSettings(db: Db, userId: string) {
  const [row] = await db
    .select({
      name: user.name,
      locale: userSettings.locale,
      theme: userSettings.theme,
      timeZone: userSettings.timeZone,
      frequencyMonths: userSettings.frequencyMonths,
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
  };
}

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
