"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInstallPrompt, useIsInstalled } from "@/lib/install-prompt";
import { detectPlatform, type Platform } from "@/lib/platform";

const PLATFORMS: Platform[] = ["ios", "android", "desktop"];

const STEPS = {
  ios: ["ios.safari", "ios.share", "ios.addToHome"],
  android: ["android.menu", "android.add"],
  desktop: ["desktop.addressBar", "desktop.menu"],
} as const;

const noSubscription = () => () => {};

/** Le système de l'appareil, connu seulement dans le navigateur (`null` au rendu serveur). */
function usePlatform(): Platform | null {
  return useSyncExternalStore(
    noSubscription,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => null,
  );
}

function Steps({ platform }: { platform: Platform }) {
  const t = useTranslations("install");
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
      {STEPS[platform].map((step) => (
        <li key={step}>{t(step)}</li>
      ))}
    </ol>
  );
}

/** Instructions du système détecté, le bouton natif quand il existe, puis les autres systèmes. */
export function InstallGuide() {
  const t = useTranslations("install");
  const platform = usePlatform();
  const installed = useIsInstalled();
  const install = useInstallPrompt();

  if (!platform) return null;
  if (installed) return <p role="status">{t("installed")}</p>;

  const others = PLATFORMS.filter((other) => other !== platform);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(`platforms.${platform}`)}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {install && (
            <Button onClick={install} className="self-start">
              {t("button")}
            </Button>
          )}
          <Steps platform={platform} />
          {platform === "ios" && <p className="text-sm text-muted-foreground">{t("ios.notifications")}</p>}
        </CardContent>
      </Card>

      <details className="rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{t("otherPlatforms")}</summary>
        <div className="mt-4 flex flex-col gap-4">
          {others.map((other) => (
            <section key={other} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t(`platforms.${other}`)}</h3>
              <Steps platform={other} />
            </section>
          ))}
        </div>
      </details>
    </div>
  );
}
