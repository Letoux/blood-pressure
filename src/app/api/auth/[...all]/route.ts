import { getAuth } from "@/server/auth";

// Routes better-auth : connexion, déconnexion, session (`/api/auth/...`).
const handle = (request: Request) => getAuth().handler(request);

export const GET = handle;
export const POST = handle;
