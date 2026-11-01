import type { Auth } from "./create-auth";

export type AdminCredentials = { email: string; password: string };

type AuthContext = Awaited<Auth["$context"]>;

/**
 * Crée ou met à jour le compte admin à partir du `.env` (ADR-0004). Lancé au démarrage :
 * - un `ADMIN_PASSWORD` modifié remplace l'ancien mot de passe et révoque les sessions admin ;
 * - un `ADMIN_EMAIL` modifié supprime l'ancien compte admin (et ses sessions) : il n'y a qu'un
 *   admin, celui du `.env`. Un compte admin n'a aucune donnée de santé à perdre.
 */
export async function ensureAdmin(auth: Auth, { email, password }: AdminCredentials): Promise<void> {
  const ctx = await auth.$context;
  const normalizedEmail = email.toLowerCase();
  const adminId = await upsertAdmin(ctx, normalizedEmail, password);
  await removeOtherAdmins(ctx, adminId);
}

async function upsertAdmin(ctx: AuthContext, email: string, password: string): Promise<string> {
  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });

  if (!existing) {
    const created = await ctx.internalAdapter.createUser(
      { email, name: "Admin", emailVerified: true, role: "admin" },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(password),
    });
    return created.id;
  }

  const { user, accounts } = existing;
  if ((user as { role?: string | null }).role !== "admin") {
    await ctx.internalAdapter.updateUser(user.id, { role: "admin" });
  }

  const credential = accounts.find((account) => account.providerId === "credential");
  if (!credential?.password) {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    return user.id;
  }

  const unchanged = await ctx.password.verify({ hash: credential.password, password });
  if (!unchanged) {
    await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(password));
    // Quiconque avait une session avec l'ancien mot de passe la perd.
    await ctx.internalAdapter.deleteUserSessions(user.id);
  }
  return user.id;
}

async function removeOtherAdmins(ctx: AuthContext, adminId: string): Promise<void> {
  const admins = await ctx.internalAdapter.listUsers(undefined, undefined, undefined, [
    { field: "role", value: "admin" },
  ]);
  for (const other of admins) {
    if (other.id !== adminId) await ctx.internalAdapter.deleteUser(other.id);
  }
}
