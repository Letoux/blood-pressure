import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/current-user";

export default async function HomePage() {
  const user = await requireUser();
  const t = await getTranslations("home");

  return (
    <>
      <PageTitle>{t("greeting", { name: user.name })}</PageTitle>
      <p className="text-sm text-muted-foreground">{t("signedInAs", { email: user.email })}</p>
      {user.role === "admin" && (
        <Button asChild className="mt-6">
          <Link href="/admin">{t("manageUsers")}</Link>
        </Button>
      )}
    </>
  );
}
