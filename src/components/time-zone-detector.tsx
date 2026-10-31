"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { orpc } from "@/lib/orpc";

/**
 * Enregistre le fuseau du navigateur quand l'utilisateur n'en a pas encore (rendu seulement dans
 * ce cas par le layout). Il reste modifiable dans les Réglages.
 */
export function TimeZoneDetector() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate } = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
        router.refresh();
      },
    }),
  );

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) mutate({ timeZone });
  }, [mutate]);

  return null;
}
