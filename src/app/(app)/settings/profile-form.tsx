"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isLocale, LOCALES } from "@/i18n/locale";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";
import { THEMES, type Theme } from "@/lib/theme";

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

/** Nom affiché, langue et thème. La langue et le thème s'appliquent dès l'enregistrement. */
export function ProfileForm() {
  const t = useTranslations("settings");
  const currentLocale = useLocale();
  const online = useOnline();
  const router = useRouter();
  const queryClient = useQueryClient();
  const settings = useQuery(orpc.settings.get.queryOptions());
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: (saved) => {
        queryClient.setQueryData(orpc.settings.get.queryKey(), saved);
        // Le serveur rend la langue et le thème : on recharge les composants serveur.
        router.refresh();
      },
    }),
  );

  if (!settings.data) return null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const locale = form.get("locale");
    const theme = form.get("theme");
    update.mutate({
      name: String(form.get("name")),
      locale: isLocale(locale) ? locale : undefined,
      theme: isTheme(theme) ? theme : undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-name">{t("profile.name")}</Label>
            <Input
              id="settings-name"
              name="name"
              autoComplete="nickname"
              defaultValue={settings.data.name}
              maxLength={100}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-locale">{t("profile.language")}</Label>
            {/* Sans langue enregistrée, celle affichée est celle du navigateur. */}
            <NativeSelect
              id="settings-locale"
              name="locale"
              defaultValue={settings.data.locale ?? currentLocale}
              className="w-full"
            >
              {LOCALES.map((locale) => (
                <NativeSelectOption key={locale} value={locale} lang={locale}>
                  {t(`languages.${locale}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-theme">{t("profile.theme")}</Label>
            <NativeSelect
              id="settings-theme"
              name="theme"
              defaultValue={settings.data.theme}
              className="w-full"
            >
              {THEMES.map((theme) => (
                <NativeSelectOption key={theme} value={theme}>
                  {t(`themes.${theme}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("profile.failed")}
            </p>
          )}
          {update.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("profile.saved")}
            </p>
          )}
          <Button type="submit" disabled={!online || update.isPending} className="self-start">
            {t("profile.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
