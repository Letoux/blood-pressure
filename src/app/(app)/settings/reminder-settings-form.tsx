"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FOLLOW_UP_DELAY_CHOICES, type ReminderPreferences } from "@/domain/reminder";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";

/**
 * Préférences de rappel (`GLOSSARY.md` : Rappel, Relance) : heures du matin et du soir, rappel la
 * veille d'une campagne, relance et son délai. Utilisé dans les Réglages et au premier lancement
 * (`submitLabel` et `onSaved` pour terminer le parcours).
 */
export function ReminderSettingsForm({
  submitLabel,
  onSaved,
}: {
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const settings = useQuery(orpc.settings.get.queryOptions());
  if (!settings.data) return null;
  return <ReminderFields saved={settings.data} submitLabel={submitLabel} onSaved={onSaved} />;
}

function ReminderFields({
  saved,
  submitLabel,
  onSaved,
}: {
  saved: ReminderPreferences;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const t = useTranslations("settings.reminders");
  const online = useOnline();
  const queryClient = useQueryClient();
  const [followUpEnabled, setFollowUpEnabled] = useState(saved.followUpEnabled);
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: (settings) => {
        queryClient.setQueryData(orpc.settings.get.queryKey(), settings);
        onSaved?.();
      },
    }),
  );

  // La liste propose toujours le délai enregistré, même s'il n'est pas parmi les choix.
  const delays = [...new Set([...FOLLOW_UP_DELAY_CHOICES, saved.followUpDelayMinutes])].sort((a, b) => a - b);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      morningTime: String(form.get("morningTime")),
      eveningTime: String(form.get("eveningTime")),
      dayBeforeReminder: form.get("dayBeforeReminder") === "on",
      followUpEnabled,
      ...(followUpEnabled ? { followUpDelayMinutes: Number(form.get("followUpDelayMinutes")) } : {}),
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-morning">{t("morning")}</Label>
              <Input id="reminder-morning" name="morningTime" type="time" required defaultValue={saved.morningTime} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-evening">{t("evening")}</Label>
              <Input id="reminder-evening" name="eveningTime" type="time" required defaultValue={saved.eveningTime} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="reminder-day-before"
              name="dayBeforeReminder"
              type="checkbox"
              defaultChecked={saved.dayBeforeReminder}
              className="size-4 accent-primary"
            />
            <Label htmlFor="reminder-day-before">{t("dayBefore")}</Label>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="reminder-follow-up"
              type="checkbox"
              checked={followUpEnabled}
              onChange={(event) => setFollowUpEnabled(event.target.checked)}
              className="size-4 accent-primary"
            />
            <Label htmlFor="reminder-follow-up">{t("followUp")}</Label>
          </div>
          {followUpEnabled && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-follow-up-delay">{t("followUpDelay")}</Label>
              <NativeSelect
                id="reminder-follow-up-delay"
                name="followUpDelayMinutes"
                defaultValue={saved.followUpDelayMinutes}
                className="w-full"
              >
                {delays.map((minutes) => (
                  <NativeSelectOption key={minutes} value={minutes}>
                    {t("delay", { count: minutes })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("failed")}
            </p>
          )}
          {update.isSuccess && !onSaved && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("saved")}
            </p>
          )}
          <Button type="submit" disabled={!online || update.isPending} className="self-start">
            {submitLabel ?? t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
