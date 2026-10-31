"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isAlertValue, readEntryRows, type EntryRow, type EntryRowsResult } from "@/domain/measurement";
import { MOMENTS, type Moment } from "@/domain/slot";
import { useCampaignFormat } from "@/lib/campaign-format";
import { orpc } from "@/lib/orpc";
import { useDraft } from "@/lib/use-draft";
import { useOnline } from "@/lib/use-online";
import { fromDateTimeLocal, newEntryDraft, type EntryDraft } from "./entry-draft";
import { AlertValueWarning, EntryErrors } from "./measurement-messages";

const FIELDS = ["systolic", "diastolic", "pulse"] as const;

/** Vrai si une ligne complète et valide est une valeur d'alerte. */
const isAlertRow = (row: EntryRow) => {
  const result = readEntryRows([row]);
  return result.ok && result.measurements.some(isAlertValue);
};

/**
 * Formulaire d'un créneau : jusqu'à 3 mesures, un horodatage et un moment communs, un
 * commentaire facultatif. Tout son état tient dans un `EntryDraft`.
 */
export function MeasurementForm({ userId }: { userId: string }) {
  // Rendu côté client seulement : l'heure et le moment par défaut sont ceux du navigateur.
  const isClient = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return isClient ? <SlotForm userId={userId} /> : null;
}

const noSubscription = () => () => {};

function SlotForm({ userId }: { userId: string }) {
  const t = useTranslations("measurements");
  const queryClient = useQueryClient();
  // Brouillon gardé dans le navigateur jusqu'à l'enregistrement, même sans réseau (ADR-0010).
  const {
    value: draft,
    setValue: setDraft,
    clear: clearDraft,
  } = useDraft<EntryDraft>(userId, "measurement", () => newEntryDraft(new Date()));
  const online = useOnline();
  const [submitted, setSubmitted] = useState<EntryRowsResult | null>(null);
  const create = useMutation(
    orpc.measurements.create.mutationOptions({
      onSuccess: () => {
        clearDraft(newEntryDraft(new Date()));
        setSubmitted(null);
        void queryClient.invalidateQueries({ queryKey: orpc.measurements.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() });
      },
    }),
  );
  // Le serveur rattache la saisie au créneau d'une campagne active (`attachMeasurement`) ;
  // le formulaire l'annonce seulement.
  const campaigns = useQuery(orpc.campaigns.overview.queryOptions());
  const campaignActive = Boolean(campaigns.data?.todaySlots);
  const format = useCampaignFormat();
  const savedSlot = create.data?.[0];

  const update = (changes: Partial<EntryDraft>) => setDraft({ ...draft, ...changes });
  const updateRow = (index: number, changes: Partial<EntryRow>) =>
    update({ rows: draft.rows.map((row, i) => (i === index ? { ...row, ...changes } : row)) });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readEntryRows(draft.rows);
    const takenAt = fromDateTimeLocal(draft.takenAt);
    setSubmitted(result);
    if (!result.ok || !takenAt) return;
    create.reset();
    create.mutate({
      takenAt,
      moment: draft.moment,
      comment: draft.comment,
      measurements: result.measurements,
    });
  }

  const rowErrors = submitted && !submitted.ok ? submitted.rowErrors : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("form.title")}</CardTitle>
        <CardDescription>{t("form.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-taken-at">{t("form.takenAt")}</Label>
              <Input
                id="entry-taken-at"
                type="datetime-local"
                value={draft.takenAt}
                onChange={(event) => update({ takenAt: event.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-moment">{t("form.moment")}</Label>
              <NativeSelect
                id="entry-moment"
                value={draft.moment}
                onChange={(event) => update({ moment: event.target.value as Moment })}
                className="w-full"
              >
                {MOMENTS.map((moment) => (
                  <NativeSelectOption key={moment} value={moment}>
                    {t(`moments.${moment}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <fieldset className="flex flex-col gap-3">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-end gap-2 text-sm font-medium">
              <span aria-hidden className="w-6" />
              {FIELDS.map((field) => (
                <span key={field} aria-hidden>
                  {t(`fields.${field}`)}
                </span>
              ))}
            </div>
            {draft.rows.map((row, index) => {
              const number = index + 1;
              const errors = rowErrors[index] ?? [];
              return (
                <div key={index} role="group" aria-label={t("form.row", { number })} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
                    <span className="w-6 text-sm text-muted-foreground" aria-hidden>
                      {number}
                    </span>
                    {FIELDS.map((field) => (
                      <Input
                        key={field}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        aria-label={t("form.fieldLabel", { field: t(`fields.${field}`), number })}
                        aria-invalid={errors.length > 0 || undefined}
                        value={row[field]}
                        onChange={(event) => updateRow(index, { [field]: event.target.value })}
                      />
                    ))}
                  </div>
                  <EntryErrors errors={errors} />
                </div>
              );
            })}
          </fieldset>

          {draft.rows.some(isAlertRow) && <AlertValueWarning />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-comment">{t("form.comment")}</Label>
            <Input
              id="entry-comment"
              value={draft.comment}
              maxLength={500}
              onChange={(event) => update({ comment: event.target.value })}
            />
          </div>

          <p className="text-sm text-muted-foreground">{t(campaignActive ? "form.campaign" : "form.free")}</p>

          {submitted && !submitted.ok && submitted.empty && <EntryErrors errors={["empty"]} />}
          {submitted && !fromDateTimeLocal(draft.takenAt) && <EntryErrors errors={["takenAt"]} />}
          {create.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("form.failed")}
            </p>
          )}
          {create.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              {savedSlot?.campaignDay
                ? t("form.savedSlot", {
                    count: create.data.length,
                    slot: format.slot({ day: savedSlot.campaignDay, moment: savedSlot.moment }),
                  })
                : t("form.saved", { count: create.data.length })}
            </p>
          )}
          <Button type="submit" disabled={!online || create.isPending} className="self-start">
            {t("form.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
