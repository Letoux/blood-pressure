"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOnline } from "@/lib/use-online";

/** Avertissement affiché sans réseau, en haut de toutes les pages connectées (ADR-0010). */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const online = useOnline();

  if (online) return null;
  return (
    <p
      role="alert"
      className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 print:hidden dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="mx-auto flex max-w-2xl items-center gap-2">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        {t("banner")}
      </span>
    </p>
  );
}
