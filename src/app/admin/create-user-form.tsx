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

export function CreateUserForm() {
  const t = useTranslations("admin.createUser");
  const online = useOnline();
  const queryClient = useQueryClient();
  const createUser = useMutation(
    orpc.admin.createUser.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.admin.listUsers.key() }),
    }),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    createUser.mutate(
      {
        email: String(form.get("email")),
        name: String(form.get("name")),
        password: String(form.get("password")),
      },
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
            <Label htmlFor="create-user-email">{t("email")}</Label>
            <Input id="create-user-email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-user-name">{t("name")}</Label>
            <Input id="create-user-name" name="name" type="text" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-user-password">{t("password")}</Label>
            <Input
              id="create-user-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          {createUser.isError && (
            <p role="alert" className="text-sm text-destructive">
              {"code" in createUser.error && createUser.error.code === "CONFLICT"
                ? t("emailTaken")
                : t("failed")}
            </p>
          )}
          {createUser.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("created", { email: createUser.data.email })}
            </p>
          )}
          <Button type="submit" disabled={!online || createUser.isPending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
