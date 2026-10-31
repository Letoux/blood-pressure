import { eq } from "drizzle-orm";
import { resolveLocale } from "@/i18n/locale";
import { translator } from "@/i18n/translator";
import { userSettings } from "@/server/db/schema";
import { sendToUser } from "@/server/push/sender";
import { userOnly } from "./authed";

/**
 * Envoie une notification de test à tous les appareils abonnés de l'appelant, dans sa langue.
 * Renvoie le nombre d'appareils atteints (0 : aucun abonnement valide).
 */
export const pushSendTest = userOnly.handler(async ({ context }) => {
  if (!context.push) throw new Error("aucun envoi push dans le contexte");
  const [saved] = await context.db
    .select({ locale: userSettings.locale })
    .from(userSettings)
    .where(eq(userSettings.userId, context.user.id));
  const t = translator(
    resolveLocale({ saved: saved?.locale ?? null, acceptLanguage: context.headers.get("accept-language") }),
  );
  const { sent } = await sendToUser(context.db, context.push, context.user.id, {
    title: t("app.name"),
    body: t("notifications.testBody"),
    url: "/",
    tag: "test",
  });
  return { sent };
});
