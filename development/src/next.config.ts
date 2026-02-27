import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/static", destination: "/static/index.html" },
      { source: "/sessions", destination: "/sessions/index.html" },
    ];
  },
};

export default nextConfig;
