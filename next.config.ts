import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is only needed for self-hosted/containerized runs.
  // Vercel ignores it; keep it for parity with the local sandbox runtime.
  output: "standalone",
  // Type errors are real deployment problems — never ignore them.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
