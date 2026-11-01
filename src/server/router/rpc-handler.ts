import { RPCHandler } from "@orpc/server/fetch";
import type { AppContext } from "./base";
import { router } from "./index";

/**
 * Taille maximale du corps d'une requête `/rpc`. oRPC lit tout le corps avant le routage, même
 * pour une procédure anonyme : sans limite, quelques gros POST épuiseraient la mémoire de l'app.
 * Les plus grosses entrées (mesure, réglages) font quelques centaines d'octets.
 */
export const RPC_MAX_BODY_BYTES = 64 * 1024;

const handler = new RPCHandler(router);

const tooLarge = () => new Response("Payload too large", { status: 413 });

/**
 * Lit le corps en s'arrêtant au-delà de la limite, puis le confie à une `Request` native neuve.
 * Le `BodyLimitPlugin` d'oRPC fait `new Request(requête, init)` : sous Node 24, la requête que
 * Next.js passe à la route n'est pas une instance native et cette copie échoue
 * (« Cannot read private member #state »). On ne lit donc que ses champs publics.
 */
async function withLimitedBody(request: Request): Promise<Request | Response> {
  if (!request.body) return request;
  if (Number(request.headers.get("content-length")) > RPC_MAX_BODY_BYTES) return tooLarge();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > RPC_MAX_BODY_BYTES) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, { method: request.method, headers: new Headers(request.headers), body });
}

/** Traite une requête HTTP `/rpc/...` (`src/app/rpc/[[...rest]]/route.ts`). */
export async function handleRpc(request: Request, context: AppContext): Promise<Response> {
  const limited = await withLimitedBody(request);
  if (limited instanceof Response) return limited;
  const { response } = await handler.handle(limited, { prefix: "/rpc", context });
  return response ?? new Response("Not found", { status: 404 });
}
