import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { resolveLocale, type Locale } from "@/i18n/locale";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";
import { currentSession } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { userSettings } from "@/server/db/schema";

/**
 * Langue et thème de la requête en cours, appliqués au rendu serveur (donc sans flash) :
 * ceux enregistrés par l'utilisateur connecté, sinon la langue du navigateur et le thème système.
 */
export const viewerPreferences = cache(async (): Promise<{ locale: Locale; theme: Theme }> => {
  const requestHeaders = await headers();
  const session = await currentSession();
  const [saved] = session
    ? await getDb()
        .select({ locale: userSettings.locale, theme: userSettings.theme })
        .from(userSettings)
        .where(eq(userSettings.userId, session.user.id))
    : [];
  return {
    locale: resolveLocale({
      saved: saved?.locale ?? null,
      acceptLanguage: requestHeaders.get("accept-language"),
    }),
    theme: saved?.theme ?? DEFAULT_THEME,
  };
});
