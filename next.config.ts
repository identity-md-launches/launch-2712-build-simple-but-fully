import type { NextConfig } from "next";

// A static export with relative asset URLs, so dist/ works at any IPFS gateway subpath or ENS name.
const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  assetPrefix: "./",
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
};

export default nextConfig;
