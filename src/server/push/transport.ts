// La requête HTTP vers un service push. `web-push` la prépare (chiffrement du message, jeton
// VAPID) mais n'est pas utilisé pour l'envoyer : son `sendNotification` n'a qu'un délai
// d'inactivité (un service qui envoie un octet de temps en temps le tient ouvert sans fin) et lit
// toute la réponse en mémoire, sans limite. L'adresse vient d'un utilisateur (`endpoint.ts`).

import type http from "node:http";
import https from "node:https";
import webpush from "web-push";
import { pushAgent } from "./endpoint";

/** Signature de `webpush.sendNotification`, remplaçable dans les tests. */
export type WebPushTransport = (
  subscription: webpush.PushSubscription,
  payload: string,
  options: webpush.RequestOptions,
) => Promise<{ statusCode: number }>;

/** Durée maximale d'un envoi, de la connexion à la fin de la réponse. */
export const PUSH_SEND_TIMEOUT_MS = 10_000;

/** Taille maximale lue d'une réponse (un service push répond par quelques octets). */
export const PUSH_MAX_RESPONSE_BYTES = 8 * 1024;

/** Comment se connecter. En production, toujours `pushAgent` en HTTPS (adresses publiques seulement). */
export type PushConnection = {
  agent: http.Agent;
  request: (url: URL, options: https.RequestOptions, callback: (res: http.IncomingMessage) => void) => http.ClientRequest;
};

const PUBLIC_HTTPS: PushConnection = { agent: pushAgent, request: https.request };

/**
 * L'envoi réel : requête préparée par `webpush.generateRequestDetails`, coupée au bout de
 * `timeoutMs` quoi qu'il arrive, et réponse lue sur au plus `maxResponseBytes`. Une réponse hors
 * 2xx lève une `WebPushError` comme `webpush.sendNotification`. Aucune exception ne sort des
 * gestionnaires d'événements : tout aboutit au rejet de la promesse.
 *
 * `connection` n'est remplacé que par les tests (service push local en HTTP).
 */
export function createWebPushTransport({
  connection = PUBLIC_HTTPS,
  timeoutMs = PUSH_SEND_TIMEOUT_MS,
  maxResponseBytes = PUSH_MAX_RESPONSE_BYTES,
}: { connection?: PushConnection; timeoutMs?: number; maxResponseBytes?: number } = {}): WebPushTransport {
  return (subscription, payload, options) => {
    const details = webpush.generateRequestDetails(subscription, payload, options);
    return new Promise((resolve, reject) => {
      let settled = false;
      let request: http.ClientRequest | undefined;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
        request?.destroy();
      };
      const guard =
        <A extends unknown[]>(handler: (...args: A) => void) =>
        (...args: A) => {
          try {
            handler(...args);
          } catch (error) {
            fail(error);
          }
        };

      try {
        request = connection.request(
          new URL(details.endpoint),
          {
            method: details.method,
            headers: details.headers,
            agent: connection.agent,
            // Délai total, pas d'inactivité : détruit la requête et sa réponse, même en cours de lecture.
            signal: AbortSignal.timeout(timeoutMs),
          },
          guard((response: http.IncomingMessage) => {
            const statusCode = response.statusCode ?? 0;
            const chunks: Buffer[] = [];
            let length = 0;
            response.on("error", fail);
            response.on(
              "data",
              guard((chunk: Buffer) => {
                length += chunk.length;
                if (length > maxResponseBytes) {
                  fail(new Error(`Réponse du service push trop longue (plus de ${maxResponseBytes} octets).`));
                  return;
                }
                chunks.push(chunk);
              }),
            );
            response.on(
              "end",
              guard(() => {
                if (settled) return;
                settled = true;
                if (statusCode >= 200 && statusCode < 300) return resolve({ statusCode });
                reject(
                  new webpush.WebPushError(
                    "Received unexpected response code",
                    statusCode,
                    response.headers as Record<string, string>,
                    Buffer.concat(chunks).toString("utf8"),
                    details.endpoint,
                  ),
                );
              }),
            );
          }),
        );
        request.on("error", fail);
        request.end(details.body ?? undefined);
      } catch (error) {
        fail(error);
      }
    });
  };
}
