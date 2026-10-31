"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/locale";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";

/** Fait télécharger ce texte au navigateur sous ce nom de fichier. */
function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Mes données : export CSV de toutes les mesures et suppression du compte (ADR-0001). */
export function DataCard() {
  const t = useTranslations("settings.data");
  const locale = useLocale();
  const router = useRouter();
  const online = useOnline();

  const exportCsv = useMutation(
    orpc.account.exportMeasurements.mutationOptions({
      onSuccess: ({ filename, csv }) => download(filename, csv),
    }),
  );
  const deleteAccount = useMutation(
    orpc.account.delete.mutationOptions({
      onSuccess: async () => {
        // Les sessions sont déjà supprimées : la déconnexion efface le cookie du navigateur.
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      },
    }),
  );

  function onExport() {
    exportCsv.mutate({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: isLocale(locale) ? locale : undefined,
    });
  }

  function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    if (window.confirm(t("deleteConfirm"))) deleteAccount.mutate({ password });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <section aria-labelledby="data-export" className="flex flex-col gap-3">
          <h3 id="data-export" className="font-medium">
            {t("exportTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("exportHelp")}</p>
          {exportCsv.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("exportFailed")}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={onExport}
            disabled={!online || exportCsv.isPending}
          >
            <Download aria-hidden />
            {t("exportButton")}
          </Button>
        </section>

        <section aria-labelledby="data-delete" className="flex flex-col gap-3">
          <h3 id="data-delete" className="font-medium">
            {t("deleteTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("deleteHelp")}</p>
          <form onSubmit={onDelete} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-password">{t("deletePassword")}</Label>
              <Input
                id="delete-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {deleteAccount.isError && (
              <p role="alert" className="text-sm text-destructive">
                {"code" in deleteAccount.error && deleteAccount.error.code === "BAD_REQUEST"
                  ? t("deleteWrongPassword")
                  : t("deleteFailed")}
              </p>
            )}
            <Button
              type="submit"
              variant="destructive"
              className="self-start"
              disabled={!online || deleteAccount.isPending || deleteAccount.isSuccess}
            >
              <Trash2 aria-hidden />
              {t("deleteButton")}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}
