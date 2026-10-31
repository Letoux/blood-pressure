import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/server/auth/current-user";

/** Espace d'administration : réservé à l'admin, dans la même coquille que les autres pages. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return <AppShell role={admin.role}>{children}</AppShell>;
}
