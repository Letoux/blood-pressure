import { Download, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { Protocol } from "@/components/protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/current-user";
import { CampaignSettingsForm } from "./campaign-settings-form";
import { DataCard } from "./data-card";
import { GuidelineForm } from "./guideline-form";
import { NotificationCard } from "./notification-card";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";
import { ReminderSettingsForm } from "./reminder-settings-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tProtocol = await getTranslations("protocol");
  const user = await requireUser();
  // L'admin n'a ni mesures, ni campagnes, ni rappels (ADR-0004).
  const isUser = user.role !== "admin";

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <div className="flex flex-col gap-6">
        <ProfileForm />
        {isUser && <CampaignSettingsForm />}
        {isUser && <GuidelineForm />}
        {isUser && <ReminderSettingsForm />}
        {isUser && <NotificationCard />}
        {isUser && (
          <Card>
            <CardHeader>
              <CardTitle>{tProtocol("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Protocol />
            </CardContent>
          </Card>
        )}
        {/* Le mot de passe de l'admin vient du `.env` et le remplacerait au redémarrage (ADR-0004). */}
        {isUser && <PasswordForm />}
        {isUser && <DataCard />}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/install">
              <Download aria-hidden />
              {t("install")}
            </Link>
          </Button>
          {isUser && (
            <Button asChild variant="outline">
              <Link href="/welcome">
                <Sparkles aria-hidden />
                {t("welcomeAgain")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
