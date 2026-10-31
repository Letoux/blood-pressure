import type { MetadataRoute } from "next";

/** Couleur de l'icône et de la barre d'état de la PWA installée. */
export const THEME_COLOR = "#b91c1c";
/** Fond de l'écran de lancement : celui du thème clair. */
export const BACKGROUND_COLOR = "#ffffff";

/**
 * Manifeste de la PWA (ADR-0002). Icônes dans `public/icons/`, générées depuis
 * `public/icons/icon.svg` par `pnpm icons`.
 */
export function webManifest({ name, description }: { name: string; description: string }): MetadataRoute.Manifest {
  return {
    name,
    short_name: name,
    description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
