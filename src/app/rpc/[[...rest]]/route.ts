import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { getPushSender } from "@/server/push";
import { handleRpc } from "@/server/router/rpc-handler";

const handle = (request: Request): Promise<Response> =>
  handleRpc(request, { db: getDb(), auth: getAuth(), push: getPushSender(), headers: request.headers });

export const GET = handle;
export const POST = handle;
