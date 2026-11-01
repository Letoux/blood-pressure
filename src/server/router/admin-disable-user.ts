import { adminOnly } from "./authed";
import { managedUserInput, requireManagedUser } from "./managed-user";

/** Désactive un utilisateur : ses sessions sont révoquées et il ne peut plus se connecter. */
export const adminDisableUser = adminOnly
  .input(managedUserInput)
  .use(requireManagedUser)
  .handler(async ({ context, input }) => {
    // `banUser` supprime aussi toutes les sessions de l'utilisateur.
    await context.auth.api.banUser({ headers: context.headers, body: { userId: input.userId } });
  });
