"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { orpc } from "@/lib/orpc";
import { passwordText as t } from "@/lib/ui-text";

/** Après une réinitialisation par l'admin : propose, sans l'imposer, de changer de mot de passe. */
export function PasswordChangeBanner() {
  const queryClient = useQueryClient();
  const me = useQuery(orpc.me.queryOptions());
  const dismiss = useMutation(
    orpc.account.dismissPasswordChangeSuggestion.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.me.key() }),
    }),
  );

  if (!me.data?.passwordChangeSuggested) return null;

  return (
    <aside role="region" aria-label={t.changeTitle}>
      <p>{t.bannerMessage}</p>
      <Link href="/settings/password">{t.bannerAction}</Link>
      <button type="button" onClick={() => dismiss.mutate({})} disabled={dismiss.isPending}>
        {t.bannerDismiss}
      </button>
    </aside>
  );
}
