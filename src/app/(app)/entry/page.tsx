import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { requireUser } from "@/server/auth/current-user";
import { viewerPreferences } from "@/server/preferences";
import { MeasurementForm } from "./measurement-form";
import { MeasurementList } from "./measurement-list";

export default async function EntryPage() {
  const user = await requireUser();
  const { timeZone } = await viewerPreferences();
  const t = await getTranslations("nav");

  return (
    <>
      <PageTitle>{t("entry")}</PageTitle>
      {/* L'admin n'a pas de mesures (ADR-0004). */}
      {user.role !== "admin" && (
        <>
          <MeasurementForm userId={user.id} timeZone={timeZone} />
          <MeasurementList />
        </>
      )}
    </>
  );
}
