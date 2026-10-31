"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

type LoginError = "tooManyAttempts" | "invalidCredentials" | "accountDisabled";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [error, setError] = useState<LoginError | null>(null);
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
          ? "tooManyAttempts"
          : signInError.code === "BANNED_USER"
            ? "accountDisabled"
            : "invalidCredentials",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">{t("title")}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">{t("email")}</Label>
              <Input id="login-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">{t("password")}</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t(error)}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {t("submit")}
            </Button>
          </form>
          {signUpOpen.data && (
            <Button asChild variant="link" className="mt-4 px-0">
              <Link href="/signup">{t("signUp")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
