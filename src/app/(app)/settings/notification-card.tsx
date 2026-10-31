"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsInstalled, usePlatform } from "@/lib/install-prompt";
import { orpc } from "@/lib/orpc";
import {
  applicationServerKey,
  pushSupported,
  serviceWorkerRegistration,
  subscriptionInput,
} from "@/lib/push-client";
import { useOnline } from "@/lib/use-online";

type Status =
  | { kind: "checking" }
  /** iOS hors PWA installée : pas de notifications avant l'installation (ADR-0002). */
  | { kind: "iosNotInstalled" }
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "off"; registration: ServiceWorkerRegistration }
  | { kind: "on"; registration: ServiceWorkerRegistration; subscription: PushSubscription };

/**
 * Autorisation des notifications et abonnement push de cet appareil, avec la notification de
 * test. Utilisé dans les Réglages et au premier lancement.
 */
export function NotificationCard() {
  const t = useTranslations("notifications");
  const platform = usePlatform();
  const installed = useIsInstalled();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>({ kind: "checking" });

  const subscribe = useMutation(orpc.push.subscribe.mutationOptions());
  const unsubscribe = useMutation(orpc.push.unsubscribe.mutationOptions());
  const sendTest = useMutation(orpc.push.sendTest.mutationOptions());

  useEffect(() => {
    if (!platform) return;
    let cancelled = false;
    void (async () => {
      const next = await currentStatus(platform === "ios" && !installed);
      if (cancelled) return;
      setStatus(next);
      // L'appareil est peut-être abonné sous un autre compte : il passe à l'utilisateur connecté.
      if (next.kind === "on") subscribe.mutate(subscriptionInput(next.subscription));
    })();
    return () => {
      cancelled = true;
    };
    // `subscribe.mutate` est stable ; on ne vérifie qu'une fois la plateforme connue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, installed]);

  const enable = useMutation({
    mutationFn: async (registration: ServiceWorkerRegistration) => {
      if ((await Notification.requestPermission()) !== "granted") return { kind: "denied" } as const;
      const { publicKey } = await queryClient.fetchQuery(orpc.push.publicKey.queryOptions());
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      });
      await subscribe.mutateAsync(subscriptionInput(subscription));
      return { kind: "on", registration, subscription } as const;
    },
    onSuccess: setStatus,
  });

  const disable = useMutation({
    mutationFn: async ({ registration, subscription }: Extract<Status, { kind: "on" }>) => {
      await unsubscribe.mutateAsync({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      return { kind: "off", registration } as const;
    },
    onSuccess: setStatus,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.kind === "iosNotInstalled" && (
          <>
            <p role="status" className="text-sm">
              {t("iosInstallFirst")}
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href="/install">{t("installLink")}</Link>
            </Button>
          </>
        )}
        {status.kind === "unsupported" && (
          <p role="status" className="text-sm">
            {t("unsupported")}
          </p>
        )}
        {status.kind === "denied" && (
          <p role="status" className="text-sm">
            {t("denied")}
          </p>
        )}
        {status.kind === "off" && (
          <Button
            onClick={() => enable.mutate(status.registration)}
            disabled={!online || enable.isPending}
            className="self-start"
          >
            {t("enable")}
          </Button>
        )}
        {status.kind === "on" && (
          <>
            <p role="status" className="text-sm">
              {t("enabled")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => sendTest.mutate({})} disabled={!online || sendTest.isPending}>
                {t("sendTest")}
              </Button>
              <Button
                variant="outline"
                onClick={() => disable.mutate(status)}
                disabled={!online || disable.isPending}
              >
                {t("disable")}
              </Button>
            </div>
            {sendTest.isSuccess && (
              <p role="status" className="text-sm text-muted-foreground">
                {sendTest.data.sent > 0 ? t("testSent") : t("testNone")}
              </p>
            )}
            {sendTest.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t("testFailed")}
              </p>
            )}
          </>
        )}
        {(enable.isError || disable.isError) && (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

async function currentStatus(iosNotInstalled: boolean): Promise<Status> {
  if (iosNotInstalled) return { kind: "iosNotInstalled" };
  if (!pushSupported()) return { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "denied" };
  const registration = await serviceWorkerRegistration();
  if (!registration) return { kind: "unsupported" };
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && Notification.permission === "granted") return { kind: "on", registration, subscription };
  return { kind: "off", registration };
}
