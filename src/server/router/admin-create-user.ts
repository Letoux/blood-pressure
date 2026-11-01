import { ORPCError } from "@orpc/server";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/create-auth";
import { adminOnly } from "./authed";

/** L'admin crée un utilisateur avec un mot de passe initial (ADR-0004). */
export const adminCreateUser = adminOnly
  .input(
    z.object({
      email: z.email(),
      name: z.string().trim().min(1),
      password: z.string().min(MIN_PASSWORD_LENGTH),
    }),
  )
  .handler(async ({ context, input }) => {
    try {
      const { user } = await context.auth.api.createUser({
        headers: context.headers,
        // Sans `role` : better-auth donne le rôle par défaut (`user`) sans exiger le droit `set-role`.
        body: input,
      });
      return { id: user.id, email: user.email, name: user.name };
    } catch (error) {
      if (error instanceof APIError && error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        throw new ORPCError("CONFLICT", { message: "Cet email est déjà utilisé." });
      }
      throw error;
    }
  });
