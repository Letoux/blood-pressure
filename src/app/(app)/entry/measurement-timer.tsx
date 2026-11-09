"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatCountdown,
  pauseTimer,
  remainingSeconds,
  restartTimer,
  resumeTimer,
  startInterval,
  startRest,
  type ProtocolTimer,
} from "@/domain/protocol-timer";
import { prepareAlarm, ringAlarm } from "@/lib/alarm";

/** L'instant présent, pour le minuteur ; appelé seulement dans des gestionnaires d'événements. */
export const clockNow = () => Date.now();

/**
 * Minuteur du protocole : repos de 5 minutes, puis 1 minute entre les mesures. Son état est tenu
 * par le formulaire. En mode automatique, la saisie d'une mesure relance l'intervalle (même en
 * pause) ; en mode manuel, l'utilisateur lance lui-même le repos ou l'intervalle, à son rythme.
 * Pendant un décompte : pause et reprise, recommencer, arrêter.
 */
export function MeasurementTimer({
  timer,
  auto,
  onChange,
}: {
  timer: ProtocolTimer | null;
  auto: boolean;
  onChange: (timer: ProtocolTimer | null) => void;
}) {
  const t = useTranslations("measurements.timer");
  const [now, setNow] = useState(() => Date.now());
  const paused = timer?.pausedAt != null;

  // Le temps restant se calcule depuis l'heure de fin : juste même si l'onglet a été mis en pause.
  useEffect(() => {
    if (!timer || timer.pausedAt !== null) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    const ring = setTimeout(ringAlarm, Math.max(0, timer.endsAt - Date.now()));
    return () => {
      clearInterval(tick);
      clearTimeout(ring);
    };
  }, [timer]);

  const remaining = timer ? remainingSeconds(timer, now) : 0;
  const counting = remaining > 0 && !paused;

  // Écran gardé allumé pendant le décompte, si le navigateur le permet.
  useEffect(() => {
    if (!counting || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    navigator.wakeLock.request("screen").then(
      (sentinel) => {
        if (released) void sentinel.release();
        else lock = sentinel;
      },
      () => {},
    );
    return () => {
      released = true;
      void lock?.release();
    };
  }, [counting]);

  /** Un geste qui (re)lance le décompte débloque aussi le son pour le signal de fin. */
  const launch = (next: ProtocolTimer) => {
    prepareAlarm();
    onChange(next);
  };

  const label = !timer
    ? ""
    : timer.measurement === 1
      ? t("rest")
      : timer.measurement === null
        ? t("intervalNext")
        : t("interval", { number: timer.measurement });

  if (timer && remaining > 0) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">{paused ? t("paused", { label }) : label}</span>
          <span
            role="timer"
            aria-label={label}
            className={`text-3xl font-semibold tabular-nums ${paused ? "text-muted-foreground" : ""}`}
          >
            {formatCountdown(remaining)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {paused ? (
            <Button type="button" variant="outline" size="sm" onClick={() => launch(resumeTimer(timer, clockNow()))}>
              <Play aria-hidden />
              {t("resume")}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(pauseTimer(timer, clockNow()))}>
              <Pause aria-hidden />
              {t("pause")}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => launch(restartTimer(timer, clockNow()))}>
            <RotateCcw aria-hidden />
            {t("restart")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t("stop")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      {timer ? (
        <p role="status" className="text-sm font-medium">
          {timer.measurement === null ? t("readyNext") : t("ready", { number: timer.measurement })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t(auto ? "hint" : "hintManual")}</p>
      )}
      {/* En automatique, la saisie relance le minuteur : le bouton ne sert qu'au départ. */}
      {(!auto || !timer) && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => launch(startRest(clockNow()))}>
            <Timer aria-hidden />
            {t(auto ? "start" : "startRest")}
          </Button>
          {!auto && (
            <Button type="button" variant="outline" onClick={() => launch(startInterval(clockNow()))}>
              <Timer aria-hidden />
              {t("startInterval")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
