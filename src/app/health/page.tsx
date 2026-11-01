"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { orpc } from "@/lib/orpc";

export default function HealthPage() {
  const t = useTranslations("health");
  const { data, isError } = useQuery(orpc.health.queryOptions());

  const label = data?.status === "ok" ? t("ok") : isError ? t("error") : "…";

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p role="status">{label}</p>
    </main>
  );
}
