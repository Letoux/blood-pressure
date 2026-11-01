"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isAlertValue, readEntryRows, type EntryRow } from "@/domain/measurement";
import { MOMENTS, type Moment } from "@/domain/slot";
import { useCampaignFormat } from "@/lib/campaign-format";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";
import { fromDateTimeLocal, toDateTimeLocal } from "./entry-draft";
import { AlertValueWarning, EntryErrors, type EntryError } from "./measurement-messages";

type Measurement = {
  id: string;
  takenAt: Date;
  systolic: number;
  diastolic: number;
  pulse: number;
  comment: string | null;
  moment: Moment;
  campaignId: string | null;
  campaignDay: number | null;
};

const FIELDS = ["systolic", "diastolic", "pulse"] as const;

/** Les mesures de l'utilisateur, de la plus récente à la plus ancienne, modifiables et supprimables. */
export function MeasurementList() {
  const t = useTranslations("measurements.list");
  const measurements = useQuery(orpc.measurements.list.queryOptions());

  return (
    <section aria-labelledby="measurement-list-title" className="mt-8 flex flex-col gap-3">
      <h2 id="measurement-list-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      {measurements.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {measurements.data?.map((measurement) => (
          <li key={measurement.id}>
            <MeasurementItem measurement={measurement} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MeasurementItem({ measurement }: { measurement: Measurement }) {
  const t = useTranslations("measurements");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const online = useOnline();
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const campaignFormat = useCampaignFormat();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.measurements.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() }),
    ]);
  const remove = useMutation(orpc.measurements.delete.mutationOptions({ onSuccess: refresh }));

  if (mode === "edit") {
    return <MeasurementEditor measurement={measurement} onDone={() => setMode("view")} />;
  }

  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-lg font-semibold tabular-nums">
            {t("list.pressure", { systolic: measurement.systolic, diastolic: measurement.diastolic })}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("list.pulse", { pulse: measurement.pulse })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {format.dateTime(measurement.takenAt, { dateStyle: "medium", timeStyle: "short" })}
          {" · "}
          {measurement.campaignDay === null
            ? `${t(`moments.${measurement.moment}`)} · ${t("list.free")}`
            : campaignFormat.slot({ day: measurement.campaignDay, moment: measurement.moment })}
        </p>
        {measurement.comment && <p className="text-sm">{measurement.comment}</p>}
        {isAlertValue(measurement) && <AlertValueWarning />}
        {remove.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("list.failed")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {mode === "confirmDelete" ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={!online || remove.isPending}
                onClick={() => remove.mutate({ id: measurement.id })}
              >
                {t("list.confirmDelete")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMode("view")}>
                {t("list.cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                {t("list.edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMode("confirmDelete")}>
                {t("list.delete")}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MeasurementEditor({ measurement, onDone }: { measurement: Measurement; onDone: () => void }) {
  const t = useTranslations("measurements");
  const queryClient = useQueryClient();
  const [takenAt, setTakenAt] = useState(toDateTimeLocal(measurement.takenAt));
  const [moment, setMoment] = useState<Moment>(measurement.moment);
  const [row, setRow] = useState<EntryRow>({
    systolic: String(measurement.systolic),
    diastolic: String(measurement.diastolic),
    pulse: String(measurement.pulse),
  });
  const online = useOnline();
  const [comment, setComment] = useState(measurement.comment ?? "");
  const [errors, setErrors] = useState<EntryError[]>([]);
  const update = useMutation(
    orpc.measurements.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.measurements.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() });
        onDone();
      },
    }),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readEntryRows([row]);
    const date = fromDateTimeLocal(takenAt);
    const values = result.ok ? result.measurements[0] : undefined;
    if (!values || !date) {
      setErrors([
        ...(result.ok ? [] : result.empty ? (["empty"] as const) : (result.rowErrors[0] ?? [])),
        ...(date ? [] : (["takenAt"] as const)),
      ]);
      return;
    }
    setErrors([]);
    update.mutate({ id: measurement.id, takenAt: date, moment, comment, ...values });
  }

  const preview = readEntryRows([row]);
  const id = (field: string) => `edit-${measurement.id}-${field}`;

  return (
    <Card className="py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{t("list.edit")}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={id("taken-at")}>{t("form.takenAt")}</Label>
              <Input
                id={id("taken-at")}
                type="datetime-local"
                value={takenAt}
                onChange={(event) => setTakenAt(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={id("moment")}>{t("form.moment")}</Label>
              <NativeSelect
                id={id("moment")}
                value={moment}
                onChange={(event) => setMoment(event.target.value as Moment)}
                className="w-full"
              >
                {MOMENTS.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {t(`moments.${value}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {FIELDS.map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <Label htmlFor={id(field)}>{t(`fields.${field}`)}</Label>
                <Input
                  id={id(field)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={row[field]}
                  onChange={(event) => setRow({ ...row, [field]: event.target.value })}
                />
              </div>
            ))}
          </div>
          {preview.ok && preview.measurements.some(isAlertValue) && <AlertValueWarning />}
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("comment")}>{t("form.comment")}</Label>
            <Input
              id={id("comment")}
              value={comment}
              maxLength={500}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <EntryErrors errors={errors} />
          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("list.failed")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!online || update.isPending}>
              {t("list.save")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onDone}>
              {t("list.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
