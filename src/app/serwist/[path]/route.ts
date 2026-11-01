import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Révision de la page hors ligne précachée : le commit, sinon (image Docker sans `.git`) un
// identifiant propre à chaque build. Calculée au build : la route est statique.
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || randomUUID();

/** Compile `src/app/sw.ts` au build et le sert à `/serwist/sw.js`. */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  // esbuild est déjà une dépendance du projet (`pnpm build:node`) : pas besoin d'esbuild-wasm.
  useNativeEsbuild: true,
});
