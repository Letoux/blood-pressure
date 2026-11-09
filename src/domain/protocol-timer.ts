// Minuteur du protocole de mesure (`GLOSSARY.md` : Protocole) : 5 minutes de repos assis avant la
// première mesure, puis environ 1 minute entre deux mesures. Domaine pur, instants en millisecondes.

/** Repos assis avant la première mesure d'un créneau. */
export const REST_SECONDS = 5 * 60;
/** Intervalle entre deux mesures d'un même créneau. */
export const INTERVAL_SECONDS = 60;
/** Nombre de mesures d'un créneau (règle du 3-3-3). */
export const MEASUREMENTS_PER_SLOT = 3;

/**
 * Un décompte : `measurement` est la mesure à prendre quand il arrive à 0, `null` pour un
 * intervalle lancé à la main (la mesure suivante, quelle qu'elle soit). `pausedAt` : l'instant de
 * la mise en pause, `null` s'il tourne. `endsAt - startedAt` reste toujours sa durée complète.
 */
export type ProtocolTimer = {
  measurement: number | null;
  startedAt: number;
  endsAt: number;
  pausedAt: number | null;
};

const countdown = (measurement: number | null, seconds: number, now: number): ProtocolTimer => ({
  measurement,
  startedAt: now,
  endsAt: now + seconds * 1000,
  pausedAt: null,
});

/** Le repos avant la première mesure, démarré à `now`. */
export function startRest(now: number): ProtocolTimer {
  return countdown(1, REST_SECONDS, now);
}

/** Un intervalle d'une minute lancé à la main (minuteur manuel). */
export function startInterval(now: number): ProtocolTimer {
  return countdown(null, INTERVAL_SECONDS, now);
}

/** Met le décompte en pause : le temps restant ne bouge plus. */
export function pauseTimer(timer: ProtocolTimer, now: number): ProtocolTimer {
  return timer.pausedAt === null ? { ...timer, pausedAt: Math.max(now, timer.startedAt) } : timer;
}

/** Reprend un décompte en pause là où il s'était arrêté. */
export function resumeTimer(timer: ProtocolTimer, now: number): ProtocolTimer {
  if (timer.pausedAt === null) return timer;
  const paused = Math.max(0, now - timer.pausedAt);
  return { ...timer, startedAt: timer.startedAt + paused, endsAt: timer.endsAt + paused, pausedAt: null };
}

/** Recommence le décompte depuis sa durée complète, pour la même mesure. */
export function restartTimer(timer: ProtocolTimer, now: number): ProtocolTimer {
  return { ...timer, startedAt: now, endsAt: now + (timer.endsAt - timer.startedAt), pausedAt: null };
}

/**
 * Le décompte qui suit le début de la saisie de la ligne `row` (0 pour la mesure 1) : 1 minute
 * avant la mesure suivante, ou plus de décompte après la dernière mesure.
 */
export function afterMeasurementStarted(row: number, now: number): ProtocolTimer | null {
  const next = row + 2;
  if (next > MEASUREMENTS_PER_SLOT) return null;
  return countdown(next, INTERVAL_SECONDS, now);
}

/** Secondes restantes, arrondies au-dessus, entre 0 et la durée du décompte (figées en pause). */
export function remainingSeconds(timer: ProtocolTimer, now: number): number {
  const at = timer.pausedAt ?? Math.max(now, timer.startedAt);
  return Math.max(0, Math.ceil((timer.endsAt - at) / 1000));
}

/** `m:ss`, pour l'affichage du décompte. */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
