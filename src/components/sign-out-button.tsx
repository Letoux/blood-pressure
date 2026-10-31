"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("common");
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={signOut}>
      <LogOut aria-hidden />
      {t("signOut")}
    </Button>
  );
}
