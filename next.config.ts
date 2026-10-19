import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los negocios se leen de tenants/*.json con fs; sin esto no viajan al despliegue en Vercel.
  outputFileTracingIncludes: {
    "/*": ["./tenants/**/*.json"],
  },
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
