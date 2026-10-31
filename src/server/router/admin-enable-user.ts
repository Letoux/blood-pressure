import { adminOnly } from "./authed";
import { managedUserInput, requireManagedUser } from "./managed-user";

/** Réactive un utilisateur désactivé, qui peut de nouveau se connecter. */
export const adminEnableUser = adminOnly
  .input(managedUserInput)
  .use(requireManagedUser)
  .handler(async ({ context, input }) => {
    await context.auth.api.unbanUser({ headers: context.headers, body: { userId: input.userId } });
  });
