import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { WelcomeFlow } from "./welcome-flow";

/**
 * Premier lancement : protocole, installation, notifications puis rappels. Affiché d'office une
 * seule fois (depuis l'accueil), et rouvert à la demande depuis les Réglages. L'admin n'a ni
 * mesures ni rappels (ADR-0004).
 */
export default async function WelcomePage() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/");
  return <WelcomeFlow />;
}
