"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FREQUENCY_MONTHS } from "@/domain/campaign";
import { DEFAULT_TIME_ZONE } from "@/domain/local-date";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";

const FREQUENCIES = Array.from(
  { length: FREQUENCY_MONTHS.max - FREQUENCY_MONTHS.min + 1 },
  (_, i) => FREQUENCY_MONTHS.min + i,
);

/** Les fuseaux IANA du navigateur, avec celui enregistré s'il n'y figure pas. */
function timeZones(saved: string): string[] {
  const known = Intl.supportedValuesOf("timeZone");
  return [...new Set([saved, "UTC", ...known])].sort();
}

/** Fréquence des campagnes et fuseau horaire, qui fixe les jours des campagnes. */
export function CampaignSettingsForm() {
  const t = useTranslations("settings.campaigns");
  const router = useRouter();
  const online = useOnline();
  const queryClient = useQueryClient();
  const settings = useQuery(orpc.settings.get.queryOptions());
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: (saved) => {
        queryClient.setQueryData(orpc.settings.get.queryKey(), saved);
        void queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() });
        // Les dates affichées par le serveur suivent le fuseau : on recharge les composants serveur.
        router.refresh();
      },
    }),
  );

  if (!settings.data) return null;
  const savedTimeZone = settings.data.timeZone ?? DEFAULT_TIME_ZONE;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      frequencyMonths: Number(form.get("frequencyMonths")),
      timeZone: String(form.get("timeZone")),
    });
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
            <Label htmlFor="settings-frequency">{t("frequency")}</Label>
            <NativeSelect
              id="settings-frequency"
              name="frequencyMonths"
              defaultValue={settings.data.frequencyMonths}
              className="w-full"
            >
              {FREQUENCIES.map((months) => (
                <NativeSelectOption key={months} value={months}>
                  {t("months", { count: months })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-time-zone">{t("timeZone")}</Label>
            <NativeSelect id="settings-time-zone" name="timeZone" defaultValue={savedTimeZone} className="w-full">
              {timeZones(savedTimeZone).map((timeZone) => (
                <NativeSelectOption key={timeZone} value={timeZone}>
                  {timeZone.replaceAll("_", " ")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
