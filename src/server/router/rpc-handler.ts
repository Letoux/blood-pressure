import { BodyLimitPlugin, RPCHandler } from "@orpc/server/fetch";
import type { AppContext } from "./base";
import { router } from "./index";

/**
 * Taille maximale du corps d'une requête `/rpc`. oRPC lit tout le corps avant le routage, même
 * pour une procédure anonyme : sans limite, quelques gros POST épuiseraient la mémoire de l'app.
 * Les plus grosses entrées (mesure, réglages) font quelques centaines d'octets.
 */
export const RPC_MAX_BODY_BYTES = 64 * 1024;

const handler = new RPCHandler(router, {
  plugins: [new BodyLimitPlugin({ maxBodySize: RPC_MAX_BODY_BYTES })],
});

/** Traite une requête HTTP `/rpc/...` (`src/app/rpc/[[...rest]]/route.ts`). */
export async function handleRpc(request: Request, context: AppContext): Promise<Response> {
  const { response } = await handler.handle(request, { prefix: "/rpc", context });
  return response ?? new Response("Not found", { status: 404 });
}
