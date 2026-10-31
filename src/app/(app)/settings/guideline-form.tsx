"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { GUIDELINES, guidelineOf, isGuidelineId, type GuidelineId } from "@/domain/guideline";
import { isLocale } from "@/i18n/locale";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";

/** Le référentiel (`GLOSSARY.md`) : son seuil est tracé sur les graphiques. Sans pays (ADR-0007). */
export function GuidelineForm() {
  const settings = useQuery(orpc.settings.get.queryOptions());
  if (!settings.data) return null;
  return <GuidelineFormLoaded saved={settings.data.guideline} />;
}

function GuidelineFormLoaded({ saved }: { saved: GuidelineId }) {
  const t = useTranslations("settings.guideline");
  const locale = useLocale();
  const language = isLocale(locale) ? locale : "fr";
  const online = useOnline();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<GuidelineId>(saved);
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: (settings) => queryClient.setQueryData(orpc.settings.get.queryKey(), settings),
    }),
  );
  const guideline = guidelineOf(selected);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate({ guideline: selected });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-guideline">{t("label")}</Label>
            <NativeSelect
              id="settings-guideline"
              name="guideline"
              value={selected}
              onChange={(event) => {
                if (isGuidelineId(event.target.value)) setSelected(event.target.value);
                update.reset();
              }}
              className="w-full"
            >
              {GUIDELINES.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {`${option.acronym} (${option.threshold.systolic}/${option.threshold.diastolic})`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1 text-sm" aria-live="polite">
            <p className="font-medium">{guideline.name[language]}</p>
            <p className="text-muted-foreground">{guideline.explanation[language]}</p>
          </div>
          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("failed")}
            </p>
          )}
          {update.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("saved")}
            </p>
          )}
          <Button type="submit" disabled={!online || update.isPending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
