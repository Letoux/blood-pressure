import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";
import { adminOnly } from "./authed";
import { managedUserInput, requireManagedUser } from "./managed-user";

/**
 * Remplace le « mot de passe oublié » (pas d'envoi de mail en v1, ADR-0004) : l'admin définit un
 * mot de passe temporaire, les sessions de l'utilisateur sont révoquées, et l'app lui propose
 * ensuite de le changer, sans l'imposer.
 */
export const adminResetPassword = adminOnly
  .input(managedUserInput.extend({ temporaryPassword: z.string().min(MIN_PASSWORD_LENGTH) }))
  .use(requireManagedUser)
  .handler(async ({ context, input }) => {
    await context.auth.api.setUserPassword({
      headers: context.headers,
      body: { userId: input.userId, newPassword: input.temporaryPassword },
    });
    const ctx = await context.auth.$context;
    await ctx.internalAdapter.updateUser(input.userId, { passwordChangeSuggested: true });
    await ctx.internalAdapter.deleteUserSessions(input.userId);
  });
