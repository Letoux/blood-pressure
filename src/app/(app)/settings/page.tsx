import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { ProfileForm } from "./profile-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <ProfileForm />
    </>
  );
}
