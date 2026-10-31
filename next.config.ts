import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Image Docker minimale : `node server.js` sans node_modules complet.
  output: "standalone",
};

// `withSerwist` : esbuild, qui compile le service worker au build, reste hors du bundle serveur.
export default withSerwist(withNextIntl(nextConfig));
