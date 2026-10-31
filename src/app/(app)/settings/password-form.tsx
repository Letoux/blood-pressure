"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

/** L'utilisateur change son mot de passe en donnant l'ancien. */
export function PasswordForm() {
  const t = useTranslations("settings.password");
  const online = useOnline();
  const queryClient = useQueryClient();
  const change = useMutation(
    orpc.account.changePassword.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.me.key() }),
    }),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    change.mutate(
      { currentPassword: String(form.get("currentPassword")), newPassword: String(form.get("newPassword")) },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-current">{t("current")}</Label>
            <Input
              id="password-current"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-new">{t("new")}</Label>
            <Input
              id="password-new"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          {change.isError && (
            <p role="alert" className="text-sm text-destructive">
              {/* Le nouveau mot de passe est déjà validé par le formulaire (`minLength`). */}
              {"code" in change.error && change.error.code === "BAD_REQUEST" ? t("wrongCurrent") : t("failed")}
            </p>
          )}
          {change.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("changed")}
            </p>
          )}
          <Button type="submit" disabled={!online || change.isPending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
