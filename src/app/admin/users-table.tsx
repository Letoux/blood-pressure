"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

type Action = "disable" | "enable" | "revokeSessions" | "resetPassword" | "delete";
type Feedback = { ok: true; action: Action } | { ok: false; message: "failed" | "temporaryPasswordTooShort" };

/** Utilisateurs de l'instance et actions de l'admin (ADR-0004). */
export function UsersTable() {
  const t = useTranslations("admin.users");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const users = useQuery(orpc.admin.listUsers.queryOptions());
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const options = (action: Action) => ({
    onSuccess: () => {
      setFeedback({ ok: true, action });
      return queryClient.invalidateQueries({ queryKey: orpc.admin.listUsers.key() });
    },
    onError: () => setFeedback({ ok: false, message: "failed" }),
  });
  const disable = useMutation(orpc.admin.disableUser.mutationOptions(options("disable")));
  const enable = useMutation(orpc.admin.enableUser.mutationOptions(options("enable")));
  const revoke = useMutation(orpc.admin.revokeSessions.mutationOptions(options("revokeSessions")));
  const reset = useMutation(orpc.admin.resetPassword.mutationOptions(options("resetPassword")));
  const remove = useMutation(orpc.admin.deleteUser.mutationOptions(options("delete")));
  const online = useOnline();
  // Hors ligne ou pendant une action en cours : aucune autre action sur les comptes.
  const busy = !online || [disable, enable, revoke, reset, remove].some((mutation) => mutation.isPending);

  function resetPassword(userId: string, email: string) {
    const temporaryPassword = window.prompt(t("temporaryPasswordPrompt", { email }));
    if (temporaryPassword === null) return;
    if (temporaryPassword.length < MIN_PASSWORD_LENGTH) {
      setFeedback({ ok: false, message: "temporaryPasswordTooShort" });
      return;
    }
    reset.mutate({ userId, temporaryPassword });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {feedback?.ok === true && (
          <p role="status" className="text-sm text-muted-foreground">
            {t(`done.${feedback.action}`)}
          </p>
        )}
        {feedback?.ok === false && (
          <p role="alert" className="text-sm text-destructive">
            {t(feedback.message)}
          </p>
        )}
        {users.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {users.data && users.data.length > 0 && (
          <ul className="flex flex-col divide-y">
            {users.data.map((user) => (
              <li key={user.id} aria-label={user.email} className="flex flex-col gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`status.${user.status}`)} ·{" "}
                    {t("createdAt", { date: format.dateTime(user.createdAt, { dateStyle: "medium" }) })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.status === "active" ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        window.confirm(t("confirmDisable", { email: user.email })) &&
                        disable.mutate({ userId: user.id })
                      }
                    >
                      {t("disable")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => enable.mutate({ userId: user.id })}>
                      {t("enable")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => revoke.mutate({ userId: user.id })}>
                    {t("revokeSessions")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => resetPassword(user.id, user.email)}>
                    {t("resetPassword")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    variant="destructive"
                    onClick={() =>
                      window.confirm(t("confirmDelete", { email: user.email })) &&
                      remove.mutate({ userId: user.id })
                    }
                  >
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
