"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { signUpText as t } from "@/lib/ui-text";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

/** Inscription libre, si l'admin l'a ouverte (le serveur la refuse sinon). */
export default function SignUpPage() {
  const router = useRouter();
  const signUpOpen = useQuery(orpc.signUpOpen.queryOptions());
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(false);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (signUpError) {
      setError(true);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main>
      <h1>{t.title}</h1>
      {signUpOpen.data === false && <p>{t.closed}</p>}
      {signUpOpen.data && (
        <form onSubmit={onSubmit}>
          <label>
            {t.name}
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            {t.email}
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            {t.password}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>
          {error && <p role="alert">{t.failed}</p>}
          <button type="submit" disabled={pending}>
            {t.submit}
          </button>
        </form>
      )}
      <Link href="/login">{t.toLogin}</Link>
    </main>
  );
}
