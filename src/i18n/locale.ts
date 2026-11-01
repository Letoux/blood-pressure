/** Langues de l'interface. Ajouter une langue : ici, puis un catalogue `messages/<langue>.json`. */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Langue par défaut quand ni l'utilisateur ni le navigateur n'en donnent une disponible. */
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Langues d'un en-tête `Accept-Language`, de la préférée à la moins préférée. */
function browserLanguages(acceptLanguage: string): string[] {
  return acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1]).find(Boolean);
      return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q), index };
    })
    .filter(({ tag, q }) => tag !== "" && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag }) => tag);
}

/**
 * Langue de l'interface : celle que l'utilisateur a enregistrée, sinon la première
 * langue disponible du navigateur, sinon le français.
 */
export function resolveLocale({
  saved,
  acceptLanguage,
}: {
  saved: Locale | null;
  acceptLanguage: string | null;
}): Locale {
  if (saved) return saved;
  for (const tag of browserLanguages(acceptLanguage ?? "")) {
    const language = tag.split("-")[0];
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}
