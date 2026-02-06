import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/reports/:path*",
        destination: "http://localhost:3001/reports/:path*"
      },
      {
        source: "/rest/:path*",
        destination: "http://localhost:8000/:path*"
      }
    ];
  }
};

export default nextConfig;
