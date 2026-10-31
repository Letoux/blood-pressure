"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { orpc } from "@/lib/orpc";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

export function CreateUserForm() {
  const queryClient = useQueryClient();
  const createUser = useMutation(
    orpc.admin.createUser.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.admin.listUsers.key() }),
    }),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    createUser.mutate(
      {
        email: String(form.get("email")),
        name: String(form.get("name")),
        password: String(form.get("password")),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Créer un utilisateur</h2>
      <label>
        Email
        <input name="email" type="email" autoComplete="off" required />
      </label>
      <label>
        Nom
        <input name="name" type="text" autoComplete="off" required />
      </label>
      <label>
        Mot de passe initial
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      {createUser.isError && (
        <p role="alert">
          {createUser.error.message || "La création de l’utilisateur a échoué."}
        </p>
      )}
      {createUser.isSuccess && (
        <p role="status">Utilisateur {createUser.data.email} créé.</p>
      )}
      <button type="submit" disabled={createUser.isPending}>
        Créer
      </button>
    </form>
  );
}
