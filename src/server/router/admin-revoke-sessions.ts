import { adminOnly } from "./authed";
import { managedUserInput, requireManagedUser } from "./managed-user";

/** Révoque toutes les sessions d'un utilisateur, qui devra se reconnecter partout. */
export const adminRevokeSessions = adminOnly
  .input(managedUserInput)
  .use(requireManagedUser)
  .handler(async ({ context, input }) => {
    await context.auth.api.revokeUserSessions({ headers: context.headers, body: { userId: input.userId } });
  });
