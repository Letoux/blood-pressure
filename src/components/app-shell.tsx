import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { OfflineBanner } from "./offline-banner";
import { PasswordChangeBanner } from "./password-change-banner";
import { SignOutButton } from "./sign-out-button";

/** Coquille des pages connectées : en-tête, contenu, barre de navigation en bas. */
export async function AppShell({
  role,
  children,
}: {
  role: string | null | undefined;
  children: ReactNode;
}) {
  const t = await getTranslations("app");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
          <span className="truncate font-semibold">{t("name")}</span>
          <SignOutButton />
        </div>
        <OfflineBanner />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <PasswordChangeBanner />
        {children}
      </main>
      <BottomNav role={role} />
    </div>
  );
}
