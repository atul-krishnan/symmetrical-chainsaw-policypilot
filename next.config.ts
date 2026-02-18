import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse"],
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
