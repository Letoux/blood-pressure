"use client";

// Signal de fin du minuteur de mesure : deux bips et une vibration, au mieux de ce que le
// navigateur permet. iOS ne joue un son que si le contexte audio a été débloqué par un geste de
// l'utilisateur : `prepareAlarm()` est appelé dans un clic ou une saisie, `ringAlarm()` plus tard.

let context: AudioContext | null = null;

/** Débloque le son ; à appeler pendant un geste de l'utilisateur. */
export function prepareAlarm(): void {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

/** Deux bips courts et une vibration ; sans effet si le navigateur ne les permet pas. */
export function ringAlarm(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration non prise en charge.
  }
  if (!context) return;
  try {
    for (const start of [0, 0.35]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.2;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + start);
      oscillator.stop(context.currentTime + start + 0.2);
    }
  } catch {
    // Son indisponible.
  }
}
