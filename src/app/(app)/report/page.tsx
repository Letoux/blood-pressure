import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { requireUser } from "@/server/auth/current-user";
import { ReportView } from "./report-view";

export default async function ReportPage() {
  const user = await requireUser();
  const t = await getTranslations("nav");

  return (
    <>
      <PageTitle>{t("report")}</PageTitle>
      {/* L'admin n'a pas de mesures (ADR-0004). */}
      {user.role !== "admin" && <ReportView userName={user.name} />}
    </>
  );
}
