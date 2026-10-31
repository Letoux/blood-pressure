import type { Auth } from "./create-auth";

export type AdminCredentials = { email: string; password: string };

/**
 * Crée ou met à jour le compte admin à partir du `.env` (ADR-0004). Lancé au démarrage :
 * un `ADMIN_PASSWORD` modifié remplace l'ancien mot de passe.
 */
export async function ensureAdmin(auth: Auth, { email, password }: AdminCredentials): Promise<void> {
  const ctx = await auth.$context;
  const normalizedEmail = email.toLowerCase();
  const existing = await ctx.internalAdapter.findUserByEmail(normalizedEmail, {
    includeAccounts: true,
  });

  if (!existing) {
    const created = await ctx.internalAdapter.createUser(
      { email: normalizedEmail, name: "Admin", emailVerified: true, role: "admin" },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(password),
    });
    return;
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
    return;
  }

  const unchanged = await ctx.password.verify({ hash: credential.password, password });
  if (!unchanged) {
    await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(password));
  }
}
