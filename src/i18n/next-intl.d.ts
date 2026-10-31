import type messages from "./messages/fr.json";
import type { Locale } from "./locale";

// Clés de traduction typées : `t("nav.hom")` ne compile pas. Le catalogue français fait foi.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
