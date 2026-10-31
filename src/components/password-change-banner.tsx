"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

/** Après une réinitialisation par l'admin : propose, sans l'imposer, de changer de mot de passe. */
export function PasswordChangeBanner() {
  const t = useTranslations("passwordBanner");
  const queryClient = useQueryClient();
  const me = useQuery(orpc.me.queryOptions());
  const dismiss = useMutation(
    orpc.account.dismissPasswordChangeSuggestion.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.me.key() }),
    }),
  );

  if (!me.data?.passwordChangeSuggested) return null;

  return (
    <section
      aria-label={t("label")}
      className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
    >
      <p>{t("message")}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/settings">{t("action")}</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(undefined)} disabled={dismiss.isPending}>
          {t("dismiss")}
        </Button>
      </div>
    </section>
  );
}
