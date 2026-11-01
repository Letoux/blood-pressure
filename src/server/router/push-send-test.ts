import { eq } from "drizzle-orm";
import { resolveLocale } from "@/i18n/locale";
import { translator } from "@/i18n/translator";
import { userSettings } from "@/server/db/schema";
import { sendToUser } from "@/server/push/sender";
import { userOnly } from "./authed";
import { limitPerUser } from "./rate-limit";

/**
 * Notifications de test par utilisateur et par fenêtre glissante : chacune fait une requête vers
 * le service push de chaque appareil, dont l'adresse vient du navigateur (`push/endpoint.ts`).
 */
export const SEND_TEST_LIMIT = { max: 5, windowSeconds: 60 } as const;

/**
 * Envoie une notification de test à tous les appareils abonnés de l'appelant, dans sa langue.
 * Renvoie le nombre d'appareils atteints (0 : aucun abonnement valide).
 */
export const pushSendTest = userOnly.use(limitPerUser(SEND_TEST_LIMIT)).handler(async ({ context }) => {
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
