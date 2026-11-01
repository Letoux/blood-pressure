import { ORPCError } from "@orpc/server";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { user } from "@/server/db/schema";
import { base } from "./base";

/** Entrée des procédures de l'admin qui agissent sur un utilisateur. */
export const managedUserInput = z.object({ userId: z.string().min(1) });

/**
 * L'utilisateur visé (`input.userId`) doit exister et ne pas être l'admin : l'admin vient du
 * `.env` et ne se gère pas ici (ADR-0004). Sinon `NOT_FOUND`.
 * Usage : `adminOnly.input(managedUserInput).use(requireManagedUser)`.
 */
export const requireManagedUser = base.middleware(async ({ context, next }, input: { userId: string }) => {
  const [target] = await context.db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, input.userId), or(isNull(user.role), ne(user.role, "admin"))));
  if (!target) throw new ORPCError("NOT_FOUND", { message: "Utilisateur introuvable." });
  return next();
});
