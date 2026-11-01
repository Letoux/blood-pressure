"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * `true` tant que le navigateur a du réseau. Sert à désactiver l'enregistrement hors ligne
 * (ADR-0010) : `<Button disabled={!online || pending}>`. Supposé en ligne au rendu serveur.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
