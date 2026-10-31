import { BarChart3, FileText, House, PencilLine, Settings, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  /** Clé du libellé dans le catalogue, sous `nav`. */
  label: "home" | "entry" | "stats" | "report" | "settings" | "admin";
  icon: LucideIcon;
};

/**
 * Barre de navigation en bas. Ajouter une page : une entrée ici, son libellé `nav.<clé>`
 * dans les deux catalogues, et sa page sous `src/app/(app)/`.
 */
const userNav: NavItem[] = [
  { href: "/", label: "home", icon: House },
  { href: "/entry", label: "entry", icon: PencilLine },
  { href: "/stats", label: "stats", icon: BarChart3 },
  { href: "/report", label: "report", icon: FileText },
  { href: "/settings", label: "settings", icon: Settings },
];

/** L'admin n'a accès à aucune mesure (ADR-0004) : ni saisie, ni statistiques, ni compte rendu. */
const adminNav: NavItem[] = [
  { href: "/", label: "home", icon: House },
  { href: "/admin", label: "admin", icon: Users },
  { href: "/settings", label: "settings", icon: Settings },
];

export function navItemsFor(role: string | null | undefined): NavItem[] {
  return role === "admin" ? adminNav : userNav;
}
