/// <reference lib="webworker" />
/**
 * Service worker de la PWA (ADR-0002), compilé par Serwist (`src/app/serwist/[path]/route.ts`)
 * et servi à `/serwist/sw.js` avec la portée `/`.
 *
 * - Ressources statiques (`/_next/static`, `public/`) : précachées à l'installation.
 * - Pages : toujours le réseau (ADR-0010, en ligne uniquement ; aucune page connectée, donc
 *   aucune donnée de santé, n'est mise en cache). Sans réseau, la page `/offline`, précachée.
 * - `/rpc` et `/api` : jamais interceptés.
 *
 * Notifications (rappels, ticket #12) : ajouter ici `self.addEventListener("push", …)` et
 * `self.addEventListener("notificationclick", …)`, après `serwist.addEventListeners()`.
 */
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_URL, matcher: ({ request }) => request.mode === "navigate" }],
  },
});

serwist.addEventListeners();
