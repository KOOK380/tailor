import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully dynamic SaaS app — session-bound data on every request; run in the
  // standard (non Cache Components) rendering model.
  cacheComponents: false,
  // Allow the embedded test browser (served from 127.0.0.1) to load dev assets.
  allowedDevOrigins: ["127.0.0.1"],
  // PGlite ships WASM assets resolved via URL/path APIs that break when
  // bundled — keep the drivers external.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "web-push"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
