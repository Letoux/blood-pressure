import { authed } from "./authed";

/** L'appelant connecté. */
export const me = authed.handler(({ context }) => {
  const { id, email, name, role, passwordChangeSuggested } = context.user;
  return {
    id,
    email,
    name,
    role: role === "admin" ? ("admin" as const) : ("user" as const),
    /** Après une réinitialisation par l'admin : proposer de changer le mot de passe. */
    passwordChangeSuggested: Boolean(passwordChangeSuggested),
  };
});
