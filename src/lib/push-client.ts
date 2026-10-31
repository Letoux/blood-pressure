// Abonnement Web Push côté navigateur. Le service worker (`src/app/sw.ts`) n'est enregistré
// qu'en production : en développement, les notifications sont donc « non prises en charge ».

/** Clé publique VAPID (base64url, format de `web-push`) en octets, pour `pushManager.subscribe`. */
export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Le navigateur sait-il recevoir des notifications push ? */
export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Le service worker actif, ou `null` s'il n'est pas enregistré (développement) au bout de 5 s. */
export async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!(await navigator.serviceWorker.getRegistration())) {
    // Juste après le premier chargement, l'enregistrement peut être en cours.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }
  return navigator.serviceWorker.ready;
}

/** L'abonnement tel que l'attend `push.subscribe`. */
export function subscriptionInput(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  return { endpoint: endpoint ?? "", keys: { p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" } };
}
