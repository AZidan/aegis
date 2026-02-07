import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker production builds
  output: 'standalone',

  // Image optimization configuration
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
