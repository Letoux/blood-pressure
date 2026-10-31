"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserStorage, draftStore } from "./draft";

/**
 * Valeurs d'un formulaire conservées dans le navigateur à chaque modification, par
 * utilisateur et par formulaire : elles survivent à un rechargement ou à une coupure réseau
 * (ADR-0010). Après un enregistrement réussi, `clear(prochainesValeurs?)` efface le brouillon
 * et remet le formulaire à zéro (par défaut, aux valeurs initiales).
 *
 * Le brouillon est relu après le premier rendu (le serveur n'a pas `localStorage`) :
 * `restored` passe alors à `true`.
 *
 * ```tsx
 * const { value, setValue, clear } = useDraft(userId, "measurement", () => newEntryDraft(new Date()));
 * ```
 */
export function useDraft<T extends object>(userId: string, form: string, initial: T | (() => T)) {
  const store = useMemo(() => draftStore<T>(browserStorage(), userId, form), [userId, form]);
  const [value, setState] = useState<T>(initial);
  const initialValue = useRef(value);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = store.load();
    // Relecture unique après l'hydratation : le serveur ne connaît pas le brouillon.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState((current) => ({ ...current, ...saved }));
    setRestored(true);
  }, [store]);

  const setValue = useCallback(
    (update: T | ((current: T) => T)) => {
      setState((current) => {
        const next = typeof update === "function" ? update(current) : update;
        store.save(next);
        return next;
      });
    },
    [store],
  );

  const clear = useCallback(
    (next?: T) => {
      store.clear();
      setState(next ?? initialValue.current);
    },
    [store],
  );

  return { value, setValue, clear, restored };
}
