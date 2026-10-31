import { asc, isNull, ne, or } from "drizzle-orm";
import { user } from "@/server/db/schema";
import { adminOnly } from "./authed";

/** Statut d'un utilisateur vu par l'admin : un compte désactivé ne peut plus se connecter. */
export type UserStatus = "active" | "disabled";

/** L'admin liste les utilisateurs, sans lui-même (ADR-0004). */
export const adminListUsers = adminOnly.handler(async ({ context }) => {
  const rows = await context.db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(or(isNull(user.role), ne(user.role, "admin")))
    .orderBy(asc(user.createdAt), asc(user.email));

  return rows.map(({ banned, ...row }) => ({
    ...row,
    status: (banned ? "disabled" : "active") as UserStatus,
  }));
});
