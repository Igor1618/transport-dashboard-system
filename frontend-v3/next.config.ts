import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*"
      },
      {
        source: "/rest/:path*",
        destination: "http://localhost:8000/rest/:path*"
      }
    ];
  }
};

export default nextConfig;
