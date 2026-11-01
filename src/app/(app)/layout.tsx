import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { TimeZoneDetector } from "@/components/time-zone-detector";
import { requireUser } from "@/server/auth/current-user";
import { viewerPreferences } from "@/server/preferences";

/** Pages connectées de l'utilisateur et de l'admin, dans la coquille avec la navigation en bas. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const { timeZoneSaved } = await viewerPreferences();
  return (
    <AppShell role={user.role}>
      {!timeZoneSaved && <TimeZoneDetector />}
      {children}
    </AppShell>
  );
}
