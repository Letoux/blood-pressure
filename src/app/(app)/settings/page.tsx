import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <div className="flex flex-col gap-6">
        <ProfileForm />
        <PasswordForm />
      </div>
    </>
  );
}
