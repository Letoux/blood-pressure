import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "@/server/router";

const link = new RPCLink({
  url: () => new URL("/rpc", window.location.origin),
});

const client: RouterClient<AppRouter> = createORPCClient(link);

/** Utilitaires TanStack Query typés : `useQuery(orpc.health.queryOptions())`. */
export const orpc = createTanstackQueryUtils(client);
