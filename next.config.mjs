/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // native 모듈은 번들하지 않음
  serverExternalPackages: ['pdfkit', 'child_process'],
  // Serverless function에서 불필요한 파일 제외 (250MB 제한 대응)
  outputFileTracingExcludes: {
    '*': [
      // 프로젝트 대용량 파일/폴더 제외
      'sample/**',
      'order_ai/**',
      'public/bottle-images/**',
      'data/**',
      'output/**',
      'scripts/**',
      'supabase/**',
      '.claude/**',
      './*.xlsx',
      './*.pptx',
      './public/bottle-images/**',
      // Dev tools
      'node_modules/typescript/**',
      'node_modules/@typescript-eslint/**',
      'node_modules/eslint/**',
      'node_modules/eslint-*/**',
      // Tailwind/CSS (빌드 시에만 필요)
      'node_modules/@tailwindcss/**',
      'node_modules/tailwindcss/**',
      'node_modules/lightningcss-*/**',
      // 불필요한 플랫폼 바이너리
      'node_modules/@next/swc-linux-*/**',
      'node_modules/@next/swc-darwin-*/**',
      // Testing/accessibility
      'node_modules/axe-core/**',
      'node_modules/caniuse-lite/**',
      // 기타
      'node_modules/lodash/**',
    ],
  },
  // pdfkit AFM 폰트 데이터 파일을 서버리스 함수에 포함
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/pdfkit/**/*'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
