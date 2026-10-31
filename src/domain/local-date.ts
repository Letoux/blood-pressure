// Dates du calendrier de l'utilisateur, dans son fuseau (IANA, réglage `user_settings.time_zone`).
// Tous les calculs de jours des campagnes passent par ici : un jour local est une chaîne
// `AAAA-MM-JJ`, jamais un instant, pour rester juste au changement d'heure.

/** Un jour du calendrier, `2026-10-31`, sans heure ni fuseau. */
export type LocalDate = string;

/** Fuseau utilisé tant que celui du navigateur n'a pas été enregistré. */
export const DEFAULT_TIME_ZONE = "Europe/Paris";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, format);
  }
  return format;
}

function parts(instant: Date, timeZone: string) {
  const values = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) };
}

/** Le jour local de `instant` dans `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return parts(instant, timeZone).date;
}

/** L'heure locale (0 à 23) de `instant` dans `timeZone`. */
export function localHourOf(instant: Date, timeZone: string): number {
  return parts(instant, timeZone).hour;
}

const toUtc = (date: LocalDate) => new Date(`${date}T00:00:00Z`);
const fromUtc = (date: Date): LocalDate => date.toISOString().slice(0, 10);
const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

/** Ajoute des mois ; un jour qui n'existe pas dans le mois d'arrivée devient son dernier jour. */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const start = toUtc(date);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return fromUtc(target);
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

export function isLocalDate(value: string): value is LocalDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value).getTime()) && fromUtc(toUtc(value)) === value;
}

const MINUTE_MS = 60 * 1000;
const wallFormatters = new Map<string, Intl.DateTimeFormat>();

/** Décalage de `timeZone` sur UTC à `instant`, en millisecondes (Paris en hiver : +1 h). */
function offsetAt(instant: number, timeZone: string): number {
  let format = wallFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    wallFormatters.set(timeZone, format);
  }
  const value = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, Number(part.value)]));
  const wall = Date.UTC(value.year!, value.month! - 1, value.day!, value.hour!, value.minute!, value.second!);
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * L'instant où il est `time` (`HH:MM`) le jour `date` dans `timeZone`. Au changement d'heure,
 * une heure qui revient deux fois (automne) donne la première ; une heure qui n'existe pas
 * (printemps, 02:30 à Paris) est décalée de la durée du saut (03:30).
 */
export function instantAt(date: LocalDate, time: string, timeZone: string): Date {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const wall = toUtc(date).getTime() + (hours * 60 + minutes) * MINUTE_MS;
  // Les deux décalages possibles ce jour-là : celui de la veille et celui du lendemain.
  const before = offsetAt(wall - DAY_MS, timeZone);
  const after = offsetAt(wall + DAY_MS, timeZone);
  const matches = [wall - before, wall - after].filter(
    (candidate) => candidate + offsetAt(candidate, timeZone) === wall,
  );
  // Sans correspondance, l'heure tombe dans le saut du printemps : le décalage d'avant le saut
  // la place juste après.
  return new Date(matches.length > 0 ? Math.min(...matches) : wall - before);
}

/** Vrai pour un fuseau IANA connu du moteur (`Europe/Paris`, `UTC`…). */
export function isTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
