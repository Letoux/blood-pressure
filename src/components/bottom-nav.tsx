"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { navItemsFor } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Barre de navigation fixée en bas de l'écran, utilisable dès 360 px de large. */
export function BottomNav({ role }: { role: string | null | undefined }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = navItemsFor(role);

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-tight font-medium text-muted-foreground transition-colors",
                  active ? "text-foreground" : "hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5 shrink-0", active && "stroke-[2.5]")} aria-hidden />
                {/* Deux lignes au plus : « Compte rendu » tient entier à 360 px. */}
                <span className="line-clamp-2 w-full text-center break-words">{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
