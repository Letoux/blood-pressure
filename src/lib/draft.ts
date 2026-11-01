/**
 * Brouillon d'un formulaire, conservé dans le navigateur (`localStorage`) jusqu'à
 * l'enregistrement (ADR-0010 : pas de file d'attente hors ligne, seulement le brouillon).
 * Le stockage peut être absent ou refuser l'accès (navigation privée, quota plein) :
 * le brouillon est alors simplement perdu, sans casser le formulaire.
 */
export type DraftStore<T> = {
  load(): T | null;
  save(value: T): void;
  clear(): void;
};

const PREFIX = "bp:draft";

export function draftKey(userId: string, form: string) {
  return `${PREFIX}:${userId}:${form}`;
}

export function draftStore<T>(storage: Storage | null, userId: string, form: string): DraftStore<T> {
  const key = draftKey(userId, form);
  return {
    load() {
      try {
        const raw = storage?.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    save(value) {
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // Stockage indisponible : le brouillon n'est pas conservé.
      }
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        // Idem.
      }
    },
  };
}

/** `localStorage`, ou `null` côté serveur ou si le navigateur en refuse l'accès. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
