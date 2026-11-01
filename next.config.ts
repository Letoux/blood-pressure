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
  // Nginx Proxy Manager n'en ajoute aucun par défaut (vérifié par `e2e/security-headers.spec.ts`).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Jamais affichée dans un cadre d'un autre site (clickjacking).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

// `withSerwist` : esbuild, qui compile le service worker au build, reste hors du bundle serveur.
export default withSerwist(withNextIntl(nextConfig));
