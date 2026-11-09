import { eq } from "drizzle-orm";
import { z } from "zod";
import { FREQUENCY_MONTHS } from "@/domain/campaign";
import { GUIDELINE_IDS } from "@/domain/guideline";
import { isTimeZone } from "@/domain/local-date";
import { FOLLOW_UP_DELAY_MINUTES, isTimeOfDay } from "@/domain/reminder";
import { LOCALES } from "@/i18n/locale";
import { user, userSettings } from "@/server/db/schema";
import { THEMES } from "@/lib/theme";
import { authed } from "./authed";
import { readSettings } from "./settings-get";

const timeOfDay = z.string().refine(isTimeOfDay, "Heure invalide (HH:MM attendu).");

/** Met à jour les réglages fournis de l'appelant, sans toucher aux autres (voir `settings-get.ts`). */
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
      entryAutoAdvance: z.boolean().optional(),
      entryAutoTimer: z.boolean().optional(),
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
