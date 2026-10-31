import { getAppSettings } from "@/server/settings/app-settings";
import { base } from "./base";

/** Public : l'inscription libre est-elle ouverte ? (page d'inscription, lien depuis la connexion) */
export const signUpOpen = base.handler(async ({ context }) => {
  const { signUpOpen } = await getAppSettings(context.db);
  return signUpOpen;
});
