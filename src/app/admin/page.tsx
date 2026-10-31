import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { requireAdmin } from "@/server/auth/current-user";
import { CreateUserForm } from "./create-user-form";
import { SignUpSetting } from "./sign-up-setting";
import { UsersTable } from "./users-table";

export default async function AdminPage() {
  // Le layout vérifie déjà le rôle ; la page le revérifie, car un layout ne protège pas seul.
  await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <div className="flex flex-col gap-6">
        <UsersTable />
        <CreateUserForm />
        <SignUpSetting />
      </div>
    </>

  );
}
