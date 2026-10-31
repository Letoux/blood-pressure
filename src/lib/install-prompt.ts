"use client";

import { useSyncExternalStore } from "react";
import { detectPlatform, type Platform } from "./platform";

/** Événement de Chrome et Edge (Android et ordinateur), absent des types du DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome envoie `beforeinstallprompt` une seule fois, souvent avant l'ouverture de la page
// d'installation : on le capte dès le chargement de l'app (ce module est importé par
// `src/app/providers.tsx`) et on le garde pour le bouton « Installer ».
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Bouton d'installation natif, quand le navigateur le propose : `install` vaut alors une
 * fonction qui ouvre la boîte de dialogue du navigateur, sinon `null`.
 */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const event = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
  if (!event) return null;
  return async () => {
    await event.prompt();
    // Le même événement ne peut servir qu'une fois.
    deferred = null;
    notify();
  };
}

const noSubscription = () => () => {};

/** Le système de l'appareil, connu seulement dans le navigateur (`null` au rendu serveur). */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(
    noSubscription,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => null,
  );
}

/** L'app tourne-t-elle déjà installée (écran d'accueil, fenêtre d'app) ? */
export function useIsInstalled(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}
