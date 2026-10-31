"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { loginText, signUpText } from "@/lib/ui-text";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signUpOpen = useQuery(orpc.signUpOpen.queryOptions());

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (signInError) {
      setError(
        signInError.status === 429
          ? "Trop de tentatives. Réessayez dans une minute."
          : signInError.code === "BANNED_USER"
            ? loginText.disabled
            : "Email ou mot de passe incorrect.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main>
      <h1>Connexion</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          Se connecter
        </button>
      </form>
      {signUpOpen.data && <Link href="/signup">{signUpText.link}</Link>}
    </main>
  );
}
