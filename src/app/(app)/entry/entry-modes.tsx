"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { orpc } from "@/lib/orpc";
import { useOnline } from "@/lib/use-online";

export type EntryModes = { entryAutoAdvance: boolean; entryAutoTimer: boolean };

/** Modes du formulaire de saisie, avec de quoi les changer (`EntryModesFields`). */
export type EntryModesState = {
  modes: EntryModes;
  loaded: boolean;
  failed: boolean;
  change: (changes: Partial<EntryModes>) => void;
};

/**
 * Les modes du formulaire de saisie (réglages de l'utilisateur), automatiques par défaut. Un
 * changement fait sur la page s'applique tout de suite et l'emporte sur les réglages relus
 * entre-temps (une relecture partie avant l'enregistrement donnerait l'ancienne valeur).
 */
export function useEntryModes(): EntryModesState {
  const queryClient = useQueryClient();
  const settings = useQuery(orpc.settings.get.queryOptions());
  const [changed, setChanged] = useState<Partial<EntryModes>>({});
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      // Un échec revient aux réglages enregistrés.
      onError: () => {
        setChanged({});
        void queryClient.invalidateQueries({ queryKey: orpc.settings.get.queryKey() });
      },
    }),
  );
  return {
    modes: {
      entryAutoAdvance: changed.entryAutoAdvance ?? settings.data?.entryAutoAdvance ?? true,
      entryAutoTimer: changed.entryAutoTimer ?? settings.data?.entryAutoTimer ?? true,
    },
    loaded: settings.isSuccess,
    failed: update.isError,
    change: (changes) => {
      setChanged((current) => ({ ...current, ...changes }));
      update.mutate(changes);
    },
  };
}

const MODES = [
  { key: "entryAutoAdvance", id: "entry-auto-advance", label: "autoAdvance" },
  { key: "entryAutoTimer", id: "entry-auto-timer", label: "autoTimer" },
] as const;

/**
 * Cases du mode de saisie, enregistrées dès qu'elles changent : décochées, le formulaire ne
 * passe plus seul au champ suivant, et le minuteur ne démarre qu'à la main.
 */
export function EntryModesFields({ modes, loaded, failed, change }: EntryModesState) {
  const t = useTranslations("measurements.modes");
  const online = useOnline();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("title")}</legend>
      {MODES.map(({ key, id, label }) => (
        <div key={key} className="flex items-center gap-3">
          <input
            id={id}
            type="checkbox"
            checked={modes[key]}
            disabled={!loaded || !online}
            onChange={(event) => change({ [key]: event.target.checked })}
            className="size-4 shrink-0 accent-primary"
          />
          <Label htmlFor={id} className="font-normal">
            {t(label)}
          </Label>
        </div>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")}
        </p>
      )}
    </fieldset>
  );
}
