import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "store-images.s-microsoft.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.s-microsoft.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.microsoft.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.xboxservices.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.xboxservices.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.xboxlive.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    imgOptTimeoutInSeconds: 30,
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
