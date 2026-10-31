import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export default async function StatsPage() {
  const t = await getTranslations("nav");
  return <ComingSoon title={t("stats")} />;
}
