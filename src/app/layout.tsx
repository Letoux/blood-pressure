import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { THEME_COLOR } from "@/lib/web-manifest";
import { viewerPreferences } from "@/server/preferences";
import { Providers } from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("name"),
    description: t("description"),
    applicationName: t("name"),
    // Le manifeste (`src/app/manifest.ts`) est lié automatiquement. iOS l'ignore en partie :
    // titre, icône et barre d'état de l'app installée lui sont donnés ici.
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Langue et thème rendus côté serveur : aucun script ni flash au chargement.
  const { locale, theme } = await viewerPreferences();

  return (
    <html lang={locale} data-theme={theme}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
