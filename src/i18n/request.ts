import { getRequestConfig } from "next-intl/server";
import { viewerPreferences } from "@/server/preferences";
import type { Locale } from "./locale";

const catalogs: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  fr: () => import("./messages/fr.json"),
  en: () => import("./messages/en.json"),
};

// Pas de langue dans l'URL : la langue vient des réglages de l'utilisateur ou du navigateur.
export default getRequestConfig(async () => {
  const { locale } = await viewerPreferences();
  return {
    locale,
    messages: (await catalogs[locale]()).default,
    timeZone: "Europe/Paris",
  };
});
