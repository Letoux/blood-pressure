import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { requireAdmin } from "@/server/auth/current-user";
import { CreateUserForm } from "./create-user-form";

export default async function AdminPage() {
  // Le layout vérifie déjà le rôle ; la page le revérifie, car un layout ne protège pas seul.
  await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <CreateUserForm />
    </>
  );
}
