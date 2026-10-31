"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { browserStorage, draftStore } from "./draft";

/**
 * Valeurs d'un formulaire conservées dans le navigateur à chaque frappe, par utilisateur et
 * par formulaire : elles survivent à un rechargement ou à une coupure réseau (ADR-0010).
 * Appeler `clear()` après un enregistrement réussi.
 *
 * Le brouillon est relu après le premier rendu (le serveur n'a pas `localStorage`) :
 * `restored` passe alors à `true`.
 *
 * ```tsx
 * const { value, setValue, clear } = useDraft(user.id, "measurement", { systolic: "", diastolic: "" });
 * ```
 */
export function useDraft<T extends object>(userId: string, form: string, initial: T) {
  const store = useMemo(() => draftStore<T>(browserStorage(), userId, form), [userId, form]);
  const [value, setState] = useState<T>(initial);
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

  const clear = useCallback(() => {
    store.clear();
    setState(initial);
    // `initial` est une valeur de départ, pas une dépendance : on ne la suit pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  return { value, setValue, clear, restored };
}
