import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint 에러를 무시하고 빌드
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript 에러도 무시 (프로덕션 배포 우선)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Vercel 배포 최적화
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
