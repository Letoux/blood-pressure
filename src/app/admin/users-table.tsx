"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { adminText as t } from "@/lib/ui-text";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

type Action = keyof typeof t.done;

export function UsersTable() {
  const queryClient = useQueryClient();
  const users = useQuery(orpc.admin.listUsers.queryOptions());
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const options = (action: Action) => ({
    onSuccess: () => {
      setFeedback({ ok: true, message: t.done[action] });
      return queryClient.invalidateQueries({ queryKey: orpc.admin.listUsers.key() });
    },
    onError: (error: Error) => setFeedback({ ok: false, message: error.message || t.failed }),
  });
  const disable = useMutation(orpc.admin.disableUser.mutationOptions(options("disable")));
  const enable = useMutation(orpc.admin.enableUser.mutationOptions(options("enable")));
  const revoke = useMutation(orpc.admin.revokeSessions.mutationOptions(options("revokeSessions")));
  const reset = useMutation(orpc.admin.resetPassword.mutationOptions(options("resetPassword")));
  const remove = useMutation(orpc.admin.deleteUser.mutationOptions(options("delete")));

  function resetPassword(userId: string, email: string) {
    const temporaryPassword = window.prompt(t.temporaryPasswordPrompt(email));
    if (temporaryPassword === null) return;
    if (temporaryPassword.length < MIN_PASSWORD_LENGTH) {
      setFeedback({ ok: false, message: t.failed });
      return;
    }
    reset.mutate({ userId, temporaryPassword });
  }

  return (
    <section>
      <h2>{t.usersTitle}</h2>
      {feedback && <p role={feedback.ok ? "status" : "alert"}>{feedback.message}</p>}
      {users.data?.length === 0 && <p>{t.noUsers}</p>}
      {users.data && users.data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t.columns.email}</th>
              <th>{t.columns.name}</th>
              <th>{t.columns.status}</th>
              <th>{t.columns.createdAt}</th>
              <th>{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td>{t.status[user.status]}</td>
                <td>{user.createdAt.toLocaleDateString()}</td>
                <td>
                  {user.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => window.confirm(t.confirmDisable(user.email)) && disable.mutate({ userId: user.id })}
                    >
                      {t.disable}
                    </button>
                  ) : (
                    <button type="button" onClick={() => enable.mutate({ userId: user.id })}>
                      {t.enable}
                    </button>
                  )}
                  <button type="button" onClick={() => revoke.mutate({ userId: user.id })}>
                    {t.revokeSessions}
                  </button>
                  <button type="button" onClick={() => resetPassword(user.id, user.email)}>
                    {t.resetPassword}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm(t.confirmDelete(user.email)) && remove.mutate({ userId: user.id })}
                  >
                    {t.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
