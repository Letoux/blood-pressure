import { createTranslator } from "next-intl";
import type { Locale } from "./locale";
import en from "./messages/en.json";
import fr from "./messages/fr.json";

const catalogs = { fr, en } as const;

/**
 * Traductions hors d'une requête Next.js (procédures qui envoient une notification, worker) :
 * même catalogue et mêmes clés que l'interface.
 */
export function translator(locale: Locale) {
  return createTranslator({ locale, messages: catalogs[locale] as typeof fr });
}
