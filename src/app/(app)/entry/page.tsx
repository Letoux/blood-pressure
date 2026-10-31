import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { requireUser } from "@/server/auth/current-user";
import { MeasurementForm } from "./measurement-form";
import { MeasurementList } from "./measurement-list";

export default async function EntryPage() {
  await requireUser();
  const t = await getTranslations("nav");

  return (
    <>
      <PageTitle>{t("entry")}</PageTitle>
      <MeasurementForm />
      <MeasurementList />
    </>
  );
}
