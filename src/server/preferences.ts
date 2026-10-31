import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_TIME_ZONE } from "@/domain/local-date";
import { resolveLocale, type Locale } from "@/i18n/locale";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";
import { currentSession } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { userSettings } from "@/server/db/schema";

export type ViewerPreferences = {
  locale: Locale;
  theme: Theme;
  /** Fuseau des réglages, sinon `DEFAULT_TIME_ZONE`. */
  timeZone: string;
  /** Faux tant que le fuseau du navigateur n'a pas été enregistré (`TimeZoneDetector`). */
  timeZoneSaved: boolean;
};

/**
 * Langue, thème et fuseau de la requête en cours, appliqués au rendu serveur (donc sans flash) :
 * ceux enregistrés par l'utilisateur connecté, sinon la langue du navigateur, le thème système et
 * le fuseau par défaut.
 */
export const viewerPreferences = cache(async (): Promise<ViewerPreferences> => {
  const requestHeaders = await headers();
  const session = await currentSession();
  const [saved] = session
    ? await getDb()
        .select({ locale: userSettings.locale, theme: userSettings.theme, timeZone: userSettings.timeZone })
        .from(userSettings)
        .where(eq(userSettings.userId, session.user.id))
    : [];
  return {
    locale: resolveLocale({
      saved: saved?.locale ?? null,
      acceptLanguage: requestHeaders.get("accept-language"),
    }),
    theme: saved?.theme ?? DEFAULT_THEME,
    timeZone: saved?.timeZone ?? DEFAULT_TIME_ZONE,
    timeZoneSaved: Boolean(saved?.timeZone),
  };
});
