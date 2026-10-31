import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { SignOutButton } from "./sign-out-button";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main>
      <h1>Bonjour {user.name}</h1>
      <p>Connecté en tant que {user.email}</p>
      {user.role === "admin" && <Link href="/admin">Gérer les utilisateurs</Link>}
      <SignOutButton />
    </main>
  );
}
