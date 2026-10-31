import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { InstallGuide } from "./install-guide";

/** Instructions pour installer la PWA sur l'écran d'accueil (ADR-0002). */
export default async function InstallPage() {
  const t = await getTranslations("install");

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <p className="mb-6 text-sm text-muted-foreground">{t("intro")}</p>
      <InstallGuide />
    </>
  );
}
