import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here is per-user and dynamic, so we opt out of Cache Components'
  // static-shell model to keep data fetching straightforward.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
