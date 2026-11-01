import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./index";

/** La session de la requête en cours, lue une seule fois par rendu (layouts et pages). */
export const currentSession = cache(async () => {
  // `headers()` d'abord : la page devient dynamique avant toute lecture du `.env`.
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

/** Pour les pages serveur : l'utilisateur connecté, sinon redirection vers `/login`. */
export async function requireUser() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Pour les pages de l'admin : l'admin connecté, sinon redirection. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
