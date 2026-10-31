import { adminOnly } from "./authed";
import { managedUserInput, requireManagedUser } from "./managed-user";

/**
 * Supprime définitivement un utilisateur et toutes ses données : chaque table qui appartient à
 * un utilisateur référence `user.id` avec `on delete cascade` (vérifié par `user-data.int.test.ts`).
 */
export const adminDeleteUser = adminOnly
  .input(managedUserInput)
  .use(requireManagedUser)
  .handler(async ({ context, input }) => {
    await context.auth.api.removeUser({ headers: context.headers, body: { userId: input.userId } });
  });
