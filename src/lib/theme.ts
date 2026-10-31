/** Thèmes de l'interface. `system` suit la préférence du système (`prefers-color-scheme`). */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";
