"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { orpc } from "@/lib/orpc";
import { passwordText as t } from "@/lib/ui-text";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

export function ChangePasswordForm() {
  const queryClient = useQueryClient();
  const change = useMutation(
    orpc.account.changePassword.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.me.key() }),
    }),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    change.mutate(
      { currentPassword: String(form.get("currentPassword")), newPassword: String(form.get("newPassword")) },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        {t.currentPassword}
        <input name="currentPassword" type="password" autoComplete="current-password" required />
      </label>
      <label>
        {t.newPassword}
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      {change.isError && <p role="alert">{change.error.message || t.failed}</p>}
      {change.isSuccess && <p role="status">{t.changed}</p>}
      <button type="submit" disabled={change.isPending}>
        {t.submit}
      </button>
    </form>
  );
}
