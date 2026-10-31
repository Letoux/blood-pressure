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
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

/** Inscription libre, si l'admin l'a ouverte (le serveur la refuse sinon). */
export default function SignUpPage() {
  const t = useTranslations("signUp");
  const router = useRouter();
  const signUpOpen = useQuery(orpc.signUpOpen.queryOptions());
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFailed(false);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setFailed(true);
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
          {signUpOpen.data === false && <p className="text-sm text-muted-foreground">{t("closed")}</p>}
          {signUpOpen.data && (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-name">{t("name")}</Label>
                <Input id="signup-name" name="name" type="text" autoComplete="name" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">{t("email")}</Label>
                <Input id="signup-email" name="email" type="email" autoComplete="username" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">{t("password")}</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              {failed && (
                <p role="alert" className="text-sm text-destructive">
                  {t("failed")}
                </p>
              )}
              <Button type="submit" disabled={pending}>
                {t("submit")}
              </Button>
            </form>
          )}
          <Button asChild variant="link" className="mt-4 px-0">
            <Link href="/login">{t("toLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
