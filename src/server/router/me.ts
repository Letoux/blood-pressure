import { authed } from "./authed";

/** L'appelant connecté. */
export const me = authed.handler(({ context }) => {
  const { id, email, name, role } = context.user;
  return { id, email, name, role: role === "admin" ? ("admin" as const) : ("user" as const) };
});
