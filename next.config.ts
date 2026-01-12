import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 배포 최적화 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
