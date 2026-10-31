import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/current-user";
import { viewerPreferences } from "@/server/preferences";
import { CampaignHome } from "./campaign-home";

export default async function HomePage() {
  const user = await requireUser();
  // Premier lancement, une seule fois (l'admin n'a pas de rappels, ADR-0004).
  if (user.role !== "admin" && !(await viewerPreferences()).onboarded) redirect("/welcome");
  const t = await getTranslations("home");

  return (
    <>
      <PageTitle>{t("greeting", { name: user.name })}</PageTitle>
      <p className="text-sm text-muted-foreground">{t("signedInAs", { email: user.email })}</p>
      {user.role === "admin" ? (
        <Button asChild className="mt-6">
          <Link href="/admin">{t("manageUsers")}</Link>
        </Button>
      ) : (
        // L'admin n'a pas de campagnes (ADR-0004).
        <CampaignHome />
      )}
    </>
  );
}
