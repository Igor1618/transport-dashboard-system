import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  // Safari 13+ compatibility: use SWC with broader target
  swcMinify: true,
  experimental: {
    // Ensure SWC transforms are applied to all packages
    forceSwcTransforms: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3010/:path*"
      },
      {
        source: "/rest/:path*",
        destination: "http://localhost:8000/rest/:path*"
      }
    ];
  }
};

export default nextConfig;
