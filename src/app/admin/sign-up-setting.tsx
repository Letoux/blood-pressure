"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/lib/orpc";

/** L'admin ouvre ou ferme l'inscription libre (fermée par défaut, ADR-0004). */
export function SignUpSetting() {
  const t = useTranslations("admin.signUp");
  const queryClient = useQueryClient();
  const settings = useQuery(orpc.admin.getSettings.queryOptions());
  const setOpen = useMutation(
    orpc.admin.setSignUpOpen.mutationOptions({
      onSuccess: (data) => queryClient.setQueryData(orpc.admin.getSettings.queryKey(), data),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={settings.data?.signUpOpen ?? false}
            disabled={!settings.data || setOpen.isPending}
            onChange={(event) => setOpen.mutate({ open: event.target.checked })}
          />
          {t("label")}
        </label>
        <p className="text-sm text-muted-foreground">{t("help")}</p>
        {setOpen.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
