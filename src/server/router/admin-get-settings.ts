import { getAppSettings } from "@/server/settings/app-settings";
import { adminOnly } from "./authed";

/** Réglages de l'instance (inscription libre). */
export const adminGetSettings = adminOnly.handler(({ context }) => getAppSettings(context.db));
