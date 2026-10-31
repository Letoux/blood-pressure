import { ORPCError } from "@orpc/server";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";
import { authed } from "./authed";

/** L'utilisateur change son mot de passe en donnant l'ancien. Sa session reste ouverte. */
export const accountChangePassword = authed
  .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(MIN_PASSWORD_LENGTH) }))
  .handler(async ({ context, input }) => {
    try {
      await context.auth.api.changePassword({ headers: context.headers, body: input });
    } catch (error) {
      if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
        throw new ORPCError("BAD_REQUEST", { message: "Le mot de passe actuel est incorrect." });
      }
      throw error;
    }
    const ctx = await context.auth.$context;
    await ctx.internalAdapter.updateUser(context.user.id, { passwordChangeSuggested: false });
  });
