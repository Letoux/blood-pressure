import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Image Docker minimale : `node server.js` sans node_modules complet.
  output: "standalone",
  // Le build ne vérifie pas les tests Playwright : `e2e/` est hors du contexte Docker
  // (`.dockerignore`). `pnpm typecheck` (tsconfig.json) les vérifie toujours.
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // Pas d'`AGENTS.md` généré par `next dev` : les consignes sont dans `CLAUDE.md`.
  agentRules: false,
};

// `withSerwist` : esbuild, qui compile le service worker au build, reste hors du bundle serveur.
export default withSerwist(withNextIntl(nextConfig));
