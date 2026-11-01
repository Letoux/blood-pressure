/** Famille d'instructions d'installation de la PWA. */
export type Platform = "ios" | "android" | "desktop";

/**
 * Système de l'appareil, d'après le navigateur. `maxTouchPoints` distingue l'iPad,
 * qui se présente comme un Mac depuis iPadOS 13.
 */
export function detectPlatform(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "desktop";
}
