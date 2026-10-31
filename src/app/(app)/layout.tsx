import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/server/auth/current-user";

/** Pages connectées de l'utilisateur et de l'admin, dans la coquille avec la navigation en bas. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <AppShell role={user.role}>{children}</AppShell>;
}
