import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker minimale : `node server.js` sans node_modules complet.
  output: "standalone",
};

export default nextConfig;
