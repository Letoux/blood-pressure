import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/**
 * Page affichée par le service worker quand une page est demandée sans réseau (précachée,
 * voir `src/app/sw.ts`). Publique et sans donnée : elle reste en cache dans le navigateur.
 */
export default async function OfflinePage() {
  const t = await getTranslations("offline");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <Button asChild>
        {/* Lien simple, pas `<Link>` : un vrai chargement de page, repassé par le réseau. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">{t("retry")}</a>
      </Button>
    </main>
  );
}
