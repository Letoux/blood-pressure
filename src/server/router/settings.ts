import { eq } from "drizzle-orm";
import { z } from "zod";
import { LOCALES } from "@/i18n/locale";
import type { Db } from "@/server/db/client";
import { user, userSettings } from "@/server/db/schema";
import { DEFAULT_THEME, THEMES } from "@/lib/theme";
import { authed } from "./authed";

/** Réglages du profil : nom affiché, langue (`null` : celle du navigateur) et thème. */
async function readSettings(db: Db, userId: string) {
  const [row] = await db
    .select({ name: user.name, locale: userSettings.locale, theme: userSettings.theme })
    .from(user)
    .leftJoin(userSettings, eq(userSettings.userId, user.id))
    .where(eq(user.id, userId));
  if (!row) throw new Error(`utilisateur ${userId} introuvable`);
  return { name: row.name, locale: row.locale ?? null, theme: row.theme ?? DEFAULT_THEME };
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
