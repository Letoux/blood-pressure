"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageTitle } from "@/components/page-title";
import { Protocol } from "@/components/protocol";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";
import { InstallGuide } from "../install/install-guide";
import { NotificationCard } from "../settings/notification-card";
import { ReminderSettingsForm } from "../settings/reminder-settings-form";

const STEPS = ["protocol", "install", "notifications", "reminders"] as const;

/** Les quatre étapes du premier lancement ; chacune peut être passée. */
export function WelcomeFlow() {
  const t = useTranslations("welcome");
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnline();
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  // Dès la première étape franchie (ou passée), l'accueil ne le rouvre plus, même si
  // l'utilisateur part en cours de route. Pas au premier affichage : la connexion rafraîchit
  // l'accueil juste après la redirection, qui doit encore mener ici.
  const markOnboarded = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: (saved) => queryClient.setQueryData(orpc.settings.get.queryKey(), saved),
    }),
  );
  const seen = () => {
    // Hors ligne, rien n'est enregistré : ce sera fait à la prochaine étape franchie en ligne.
    if (online && markOnboarded.isIdle) markOnboarded.mutate({ onboarded: true });
  };

  const finish = () => router.push("/");
  const next = () => {
    seen();
    if (last) finish();
    else setIndex(index + 1);
  };

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {t("progress", { current: index + 1, total: STEPS.length })}
          </p>
          <h2 className="text-xl font-semibold">{t(`steps.${step}`)}</h2>
        </div>
        {step === "protocol" && <Protocol />}
        {step === "install" && (
          <>
            <p className="text-sm text-muted-foreground">{t("installIntro")}</p>
            <InstallGuide />
          </>
        )}
        {step === "notifications" && <NotificationCard />}
        {step === "reminders" && (
          <>
            <p className="text-sm text-muted-foreground">{t("remindersIntro")}</p>
            <ReminderSettingsForm submitLabel={t("finish")} onSaved={finish} />
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {!last && <Button onClick={next}>{t("next")}</Button>}
          <Button variant="ghost" onClick={next}>
            {t("skip")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("later")}</p>
      </div>
    </>
  );
}
