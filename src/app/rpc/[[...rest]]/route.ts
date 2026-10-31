import { RPCHandler } from "@orpc/server/fetch";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { router } from "@/server/router";

const handler = new RPCHandler(router);

async function handle(request: Request): Promise<Response> {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: { db: getDb(), auth: getAuth(), headers: request.headers },
  });
  return response ?? new Response("Not found", { status: 404 });
}

export const GET = handle;
export const POST = handle;
