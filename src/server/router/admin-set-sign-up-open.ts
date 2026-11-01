import { z } from "zod";
import { updateAppSettings } from "@/server/settings/app-settings";
import { adminOnly } from "./authed";

/** L'admin ouvre ou ferme l'inscription libre (fermée par défaut, ADR-0004). */
export const adminSetSignUpOpen = adminOnly
  .input(z.object({ open: z.boolean() }))
  .handler(({ context, input }) => updateAppSettings(context.db, { signUpOpen: input.open }));
