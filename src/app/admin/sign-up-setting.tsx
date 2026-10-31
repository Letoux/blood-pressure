"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { adminText as t } from "@/lib/ui-text";

export function SignUpSetting() {
  const queryClient = useQueryClient();
  const settings = useQuery(orpc.admin.getSettings.queryOptions());
  const setOpen = useMutation(
    orpc.admin.setSignUpOpen.mutationOptions({
      onSuccess: (data) => queryClient.setQueryData(orpc.admin.getSettings.queryKey(), data),
    }),
  );

  return (
    <section>
      <h2>{t.settingsTitle}</h2>
      <label>
        <input
          type="checkbox"
          checked={settings.data?.signUpOpen ?? false}
          disabled={!settings.data || setOpen.isPending}
          onChange={(event) => setOpen.mutate({ open: event.target.checked })}
        />
        {t.signUpOpenLabel}
      </label>
      <p>{t.signUpHelp}</p>
      {setOpen.isError && <p role="alert">{setOpen.error.message || t.failed}</p>}
    </section>
  );
}
