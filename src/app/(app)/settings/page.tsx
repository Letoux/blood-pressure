import { Download } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/current-user";
import { DataCard } from "./data-card";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const user = await requireUser();

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <div className="flex flex-col gap-6">
        <ProfileForm />
        <PasswordForm />
        {/* L'admin n'a pas de mesures, et son compte vient du `.env` (ADR-0004). */}
        {user.role !== "admin" && <DataCard />}
        <Button asChild variant="outline" className="self-start">
          <Link href="/install">
            <Download aria-hidden />
            {t("install")}
          </Link>
        </Button>
      </div>
    </>
  );
}
