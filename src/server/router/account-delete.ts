import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { userOnly } from "./authed";
import { limitPasswordAttempts } from "./password-attempts";

/**
 * L'utilisateur supprime son compte après avoir confirmé son mot de passe (ADR-0001). Toutes ses
 * données partent avec lui : chaque table qui lui appartient référence `user.id` avec
 * `on delete cascade` (`user-data.int.test.ts`). Toutes ses sessions sont supprimées ; le client
 * se déconnecte ensuite pour effacer le cookie.
 *
 * Interdit à l'admin (`userOnly`) : son compte vient du `.env` (ADR-0004). La route
 * `/api/auth/delete-user` de better-auth reste désactivée, car elle accepterait une session
 * récente sans mot de passe.
 */
export const accountDelete = userOnly
  .use(limitPasswordAttempts)
  .input(z.object({ password: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const ctx = await context.auth.$context;
    const userId = context.user.id;
    const credential = await ctx.internalAdapter.findCredentialAccount(userId);
    const valid =
      credential?.password != null &&
      (await ctx.password.verify({ hash: credential.password, password: input.password }));
    if (!valid) throw new ORPCError("BAD_REQUEST", { message: "Le mot de passe est incorrect." });

    await ctx.internalAdapter.deleteUserSessions(userId);
    await ctx.internalAdapter.deleteUser(userId);
  });
