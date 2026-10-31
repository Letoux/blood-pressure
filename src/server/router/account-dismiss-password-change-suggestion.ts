import { authed } from "./authed";

/** L'utilisateur ferme le bandeau qui propose de changer le mot de passe (ADR-0004). */
export const accountDismissPasswordChangeSuggestion = authed.handler(async ({ context }) => {
  const ctx = await context.auth.$context;
  await ctx.internalAdapter.updateUser(context.user.id, { passwordChangeSuggested: false });
});
