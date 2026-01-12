import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 배포 최적화 설정
  // output을 명시하지 않음 (기본값 사용 = 동적 렌더링)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // API 라우트가 동적으로 처리되도록 보장
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
