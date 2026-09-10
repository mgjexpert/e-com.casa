import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: false },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/api/webhooks/xpayments",
        destination: "/api/webhooks/xpayments-v2",
      },
    ];
  },
};

export default nextConfig;
