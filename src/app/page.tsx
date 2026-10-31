import Link from "next/link";
import { passwordText } from "@/lib/ui-text";
import { requireUser } from "@/server/auth/current-user";
import { PasswordChangeBanner } from "./password-change-banner";
import { SignOutButton } from "./sign-out-button";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main>
      <PasswordChangeBanner />
      <h1>Bonjour {user.name}</h1>
      <p>Connecté en tant que {user.email}</p>
      {user.role === "admin" && <Link href="/admin">Gérer les utilisateurs</Link>}
      <Link href="/settings/password">{passwordText.changeTitle}</Link>
      <SignOutButton />
    </main>
  );
}
