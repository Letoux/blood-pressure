import { Hourglass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTitle } from "./page-title";

/** État « bientôt » d'une page de la navigation pas encore construite. */
export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("comingSoon");

  return (
    <>
      <PageTitle>{title}</PageTitle>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <Hourglass className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
    </>
  );
}
