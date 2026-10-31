import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { requireUser } from "@/server/auth/current-user";
import { StatsView } from "./stats-view";

export default async function StatsPage() {
  const user = await requireUser();
  const t = await getTranslations("nav");

  return (
    <>
      <PageTitle>{t("stats")}</PageTitle>
      {/* L'admin n'a pas de mesures (ADR-0004). */}
      {user.role !== "admin" && <StatsView />}
    </>
  );
}
