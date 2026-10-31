// Tâche des rappels du worker (ADR-0003), lancée chaque minute par pg-boss (`main.ts`). Le domaine
// (`dueReminders`) décide quoi envoyer ; la tâche lit la base, envoie par Web Push et journalise
// dans `notification`. L'envoi et l'instant présent sont injectés : les tests passent un faux
// service push et une horloge fixée.
//
// Idempotence : la ligne du journal est écrite *avant* l'envoi, et la contrainte d'unicité
// (utilisateur, canal, type, jour, moment) fait qu'un seul passage la crée, même si deux passages
// se chevauchent. Si l'envoi échoue sur tous les appareils (service push injoignable), la ligne
// est retirée : le rappel est réessayé au passage suivant, tant qu'il est dans son délai de
// rattrapage (`REMINDER_GRACE_MINUTES`).

import { and, eq, gte, isNull, not, or } from "drizzle-orm";
import { campaignOverview } from "@/domain/campaign";
import { addDays } from "@/domain/local-date";
import {
  dueReminders,
  reminderKey,
  REMINDER_DEFAULTS,
  type DueReminder,
  type ReminderPreferences,
  type TimeOfDay,
} from "@/domain/reminder";
import { resolveLocale, type Locale } from "@/i18n/locale";
import { translator } from "@/i18n/translator";
import type { PushMessage } from "@/lib/push-message";
import { loadCampaignInput } from "@/server/campaigns/campaign-input";
import type { Db } from "@/server/db/client";
import { notification, pushSubscription, user, userSettings } from "@/server/db/schema";
import { sendToUser, type PushSender } from "@/server/push/sender";

export type ReminderRunReport = {
  /** Rappels envoyés (au moins un appareil atteint). */
  reminders: number;
  /** Appareils atteints, abonnements expirés supprimés, envois en échec. */
  sent: number;
  removed: number;
  failed: number;
};

/** Le texte d'un rappel, dans la langue de l'utilisateur. */
export function reminderMessage(reminder: DueReminder, locale: Locale): PushMessage {
  const t = translator(locale);
  if (reminder.kind === "dayBefore") {
    return { title: t("reminders.dayBeforeTitle"), body: t("reminders.dayBeforeBody"), url: "/", tag: `reminder-${reminder.date}` };
  }
  const day = reminder.day ?? 1;
  return {
    title: t(reminder.moment === "morning" ? "reminders.morningTitle" : "reminders.eveningTitle"),
    body: t(reminder.kind === "slot" ? "reminders.slotBody" : "reminders.followUpBody", { day }),
    url: "/entry",
    // La relance remplace le rappel du même créneau sur l'appareil, au lieu de s'empiler.
    tag: `reminder-${reminder.date}-${reminder.moment}`,
  };
}

/** Un passage : envoie les rappels dus à `now` à tous les utilisateurs qui ont un appareil abonné. */
export async function runReminders({ db, sender, now }: { db: Db; sender: PushSender; now: Date }) {
  const report: ReminderRunReport = { reminders: 0, sent: 0, removed: 0, failed: 0 };

  // Utilisateurs ayant au moins un appareil abonné, hors comptes désactivés (l'admin n'a ni
  // campagne ni rappel). Sans ligne de réglages, les valeurs par défaut s'appliquent.
  const recipients = await db
    .selectDistinct({
      userId: user.id,
      locale: userSettings.locale,
      morningTime: userSettings.morningTime,
      eveningTime: userSettings.eveningTime,
      dayBeforeReminder: userSettings.dayBeforeReminder,
      followUpEnabled: userSettings.followUpEnabled,
      followUpDelayMinutes: userSettings.followUpDelayMinutes,
    })
    .from(user)
    .innerJoin(pushSubscription, eq(pushSubscription.userId, user.id))
    .leftJoin(userSettings, eq(userSettings.userId, user.id))
    .where(or(isNull(user.banned), not(user.banned)));

  for (const recipient of recipients) {
    try {
      const preferences: ReminderPreferences = {
        morningTime: (recipient.morningTime ?? REMINDER_DEFAULTS.morningTime) as TimeOfDay,
        eveningTime: (recipient.eveningTime ?? REMINDER_DEFAULTS.eveningTime) as TimeOfDay,
        dayBeforeReminder: recipient.dayBeforeReminder ?? REMINDER_DEFAULTS.dayBeforeReminder,
        followUpEnabled: recipient.followUpEnabled ?? REMINDER_DEFAULTS.followUpEnabled,
        followUpDelayMinutes: recipient.followUpDelayMinutes ?? REMINDER_DEFAULTS.followUpDelayMinutes,
      };
      const input = await loadCampaignInput(db, recipient.userId, now);
      const overview = campaignOverview(input);

      // Les rappels déjà journalisés depuis la veille suffisent : un rappel plus ancien n'est
      // plus dû de toute façon.
      const logged = await db
        .select({ kind: notification.kind, date: notification.date, moment: notification.moment })
        .from(notification)
        .where(
          and(
            eq(notification.userId, recipient.userId),
            eq(notification.channel, "push"),
            gte(notification.date, addDays(overview.today, -1)),
          ),
        );
      const sent = new Set(logged.map((row) => reminderKey(row.kind, row.date, row.moment)));

      const due = dueReminders({ preferences, timeZone: input.timeZone, overview, sent, now });
      const locale = resolveLocale({ saved: recipient.locale, acceptLanguage: null });
      for (const reminder of due) {
        const [claimed] = await db
          .insert(notification)
          .values({
            userId: recipient.userId,
            channel: "push",
            kind: reminder.kind,
            date: reminder.date,
            moment: reminder.moment,
            sentAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: notification.id });
        // Déjà pris par un autre passage.
        if (!claimed) continue;

        const delivery = await sendToUser(db, sender, recipient.userId, reminderMessage(reminder, locale));
        report.sent += delivery.sent;
        report.removed += delivery.removed;
        report.failed += delivery.failed;
        if (delivery.sent > 0) report.reminders += 1;
        if (delivery.sent === 0 && delivery.failed > 0) {
          await db.delete(notification).where(eq(notification.id, claimed.id));
        }
      }
    } catch (error) {
      // Un utilisateur en erreur n'empêche pas les rappels des autres.
      console.error(`[worker] rappels de ${recipient.userId} en échec`, error);
    }
  }
  return report;
}
