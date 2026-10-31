import Link from "next/link";
import { passwordText as t } from "@/lib/ui-text";
import { requireUser } from "@/server/auth/current-user";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <main>
      <h1>{t.changeTitle}</h1>
      <ChangePasswordForm />
      <Link href="/">{t.back}</Link>
    </main>
  );
}
