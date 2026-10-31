"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ORPCError } from "@orpc/client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPECTED_MEASUREMENTS, type CampaignOverview, type CampaignView, type SlotView } from "@/domain/campaign";
import type { LocalDate } from "@/domain/local-date";
import { useCampaignFormat } from "@/lib/campaign-format";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/**
 * Accueil de l'utilisateur : aucune campagne (planifier la première), prochaine campagne
 * (avancer ou reporter), créneaux du jour et leur état, puis l'historique des campagnes.
 */
export function CampaignHome() {
  const overview = useQuery(orpc.campaigns.overview.queryOptions());
  if (!overview.data) return null;
  const data = overview.data;
  const history = data.campaigns.filter((campaign) => campaign.status !== "planned").reverse();

  return (
    <div className="mt-6 flex flex-col gap-6">
      {data.next === null && !data.current ? (
        <FirstCampaign today={data.today} />
      ) : (
        <>
          {data.current && <CurrentCampaign campaign={data.current} />}
          {data.todaySlots && <TodaySlots overview={data} />}
          {!data.current && data.next && <NextCampaign overview={data} />}
        </>
      )}
      {history.length > 0 && <CampaignHistory campaigns={history} />}
    </div>
  );
}

function useSchedule() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campaigns.schedule.mutationOptions({
      onSuccess: (overview) => queryClient.setQueryData(orpc.campaigns.overview.queryKey(), overview),
    }),
  );
}

function ScheduleForm({ defaultDate, min, submitLabel }: { defaultDate: LocalDate; min: LocalDate; submitLabel: string }) {
  const t = useTranslations("campaigns.schedule");
  const online = useOnline();
  const schedule = useSchedule();
  const [start, setStart] = useState(defaultDate);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    schedule.mutate({ start });
  }

  const error = schedule.error;
  const message =
    error instanceof ORPCError && error.code === "BAD_REQUEST"
      ? t("past")
      : error instanceof ORPCError && error.code === "CONFLICT"
        ? t("overlap")
        : t("failed");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-start">{t("start")}</Label>
        <Input
          id="campaign-start"
          type="date"
          min={min}
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required
        />
      </div>
      {schedule.isError && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <Button type="submit" disabled={!online || schedule.isPending || !start} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}

function FirstCampaign({ today }: { today: LocalDate }) {
  const t = useTranslations("campaigns");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("none.title")}</CardTitle>
        <CardDescription>{t("none.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScheduleForm defaultDate={today} min={today} submitLabel={t("schedule.first")} />
      </CardContent>
    </Card>
  );
}

function NextCampaign({ overview }: { overview: CampaignOverview }) {
  const t = useTranslations("campaigns");
  const format = useCampaignFormat();
  const next = overview.next;
  if (!next) return null;
  const startsToday = overview.todaySlots !== null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("next.title")}</CardTitle>
        <CardDescription>
          {startsToday ? t("next.startsToday") : t("next.on", { date: format.date(next.plannedStart, "full") })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScheduleForm
          key={next.plannedStart}
          defaultDate={next.plannedStart}
          min={overview.today}
          submitLabel={t("schedule.move")}
        />
      </CardContent>
    </Card>
  );
}

function CurrentCampaign({ campaign }: { campaign: CampaignView }) {
  const t = useTranslations("campaigns");
  const format = useCampaignFormat();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("current.title")}</CardTitle>
        <CardDescription>{t("current.since", { date: format.date(campaign.actualStart ?? campaign.plannedStart) })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="font-medium tabular-nums">
          {t("completeness", { count: campaign.completeness, total: EXPECTED_MEASUREMENTS })}
        </p>
        <SlotGrid slots={campaign.slots} />
      </CardContent>
    </Card>
  );
}

/** Les 6 créneaux d'une campagne : J1 à J3 en lignes, matin et soir en colonnes. */
function SlotGrid({ slots }: { slots: SlotView[] }) {
  const format = useCampaignFormat();
  return (
    <ul className="grid grid-cols-2 gap-2 text-sm">
      {slots.map((slot) => (
        <li
          key={`${slot.day}-${slot.moment}`}
          className={cn(
            "rounded-md border px-3 py-2 tabular-nums",
            slot.filled ? "border-primary/40 bg-primary/10" : "text-muted-foreground",
          )}
        >
          {format.slot(slot)} · {slot.count}/3
        </li>
      ))}
    </ul>
  );
}

function TodaySlots({ overview }: { overview: CampaignOverview }) {
  const t = useTranslations("campaigns.today");
  const format = useCampaignFormat();
  const slots = overview.todaySlots?.slots ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2" aria-label={t("title")}>
          {slots.map((slot) => (
            <li key={slot.moment} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className="font-medium">
                {format.slot(slot)}
                {slot.moment === overview.moment && <span className="text-muted-foreground"> · {t("now")}</span>}
              </span>
              <span className={cn("text-sm", slot.filled ? "text-primary" : "text-muted-foreground")}>
                {slot.filled ? t("filled", { count: slot.count }) : t("todo")}
              </span>
            </li>
          ))}
        </ul>
        <Button asChild className="self-start">
          <Link href="/entry">{t("enter")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const round = (value: number) => Math.round(value);

function CampaignHistory({ campaigns }: { campaigns: CampaignView[] }) {
  const t = useTranslations("campaigns.history");
  return (
    <section aria-labelledby="campaign-history-title" className="flex flex-col gap-3">
      <h2 id="campaign-history-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-3">
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <CampaignItem campaign={campaign} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CampaignItem({ campaign }: { campaign: CampaignView }) {
  const t = useTranslations("campaigns");
  const format = useCampaignFormat();
  const queryClient = useQueryClient();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(
    orpc.campaigns.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.measurements.key() });
      },
    }),
  );
  const { global, morning, evening } = campaign.averages;
  const start = campaign.actualStart ?? campaign.plannedStart;

  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold">
            {campaign.actualStart
              ? t("history.from", { start: format.date(start, "medium"), end: format.date(campaign.endDate, "medium") })
              : t("history.plannedOn", { date: format.date(start, "medium") })}
          </p>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              campaign.status === "finished" ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive",
              campaign.status === "inProgress" && "border-border text-foreground",
            )}
          >
            {t(`status.${campaign.status}`)}
          </span>
        </div>
        {campaign.status !== "missed" && (
          <p className="text-sm tabular-nums">
            {t("completeness", { count: campaign.completeness, total: EXPECTED_MEASUREMENTS })}
          </p>
        )}
        {campaign.status !== "missed" && campaign.missingSlots.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("missingSlots", { slots: campaign.missingSlots.map(format.slot).join(", ") })}
          </p>
        )}
        {global && (
          <p className="text-sm tabular-nums">
            {t("history.average", {
              systolic: round(global.systolic),
              diastolic: round(global.diastolic),
              count: global.count,
            })}
            {morning && ` · ${t("history.morning", { systolic: round(morning.systolic), diastolic: round(morning.diastolic) })}`}
            {evening && ` · ${t("history.evening", { systolic: round(evening.systolic), diastolic: round(evening.diastolic) })}`}
          </p>
        )}
        {remove.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("history.failed")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={!online || remove.isPending}
                onClick={() => remove.mutate({ id: campaign.id })}
              >
                {t("history.confirmDelete")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                {t("history.cancel")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              {t("history.delete")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
