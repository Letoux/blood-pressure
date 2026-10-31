import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./index";

/** Pour les pages serveur : l'utilisateur connecté, sinon redirection vers `/login`. */
export async function requireUser() {
  // `headers()` d'abord : la page devient dynamique avant toute lecture du `.env`.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/login");
  return session.user;
}
