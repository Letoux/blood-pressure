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
 * - Notifications (rappels, notification de test) : `push` affiche le message envoyé par le
 *   serveur (`src/server/push/sender.ts`, format `PushMessage`) ; `notificationclick` ouvre la
 *   page du message (par exemple `/entry`) dans une fenêtre de l'app déjà ouverte, sinon une
 *   nouvelle.
 */
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";
import { parsePushMessage } from "../lib/push-message";

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

self.addEventListener("push", (event) => {
  // Le serveur envoie toujours un titre ; à défaut (message illisible), le nom du site.
  const message = parsePushMessage(event.data?.text(), self.location.host);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data as { url?: string } | null)?.url ?? "/";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
