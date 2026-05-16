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
  // 보안 헤더: 모든 응답에 기본 공격 방어 강화
  async headers() {
    // dev 환경에서는 HTTPS 강제 헤더(HSTS, upgrade-insecure-requests)를 빼서
    // http://localhost 접속이 자동 https 전환으로 끊기는 것을 방지.
    const isDev = process.env.NODE_ENV !== 'production';

    // Content-Security-Policy:
    //  - script-src: Next.js hydration/SWC 때문에 'unsafe-inline' 'unsafe-eval' 필요
    //  - style-src: Tailwind JIT 때문에 'unsafe-inline' 필요
    //  - img-src: base64 로고/Vivino 외부 이미지까지 허용 (data:/blob:/https:)
    //  - connect-src: self 만 (외부 API는 모두 backend 경유)
    //  - frame-ancestors 'self' (같은 오리진 iframe 허용 — 테이스팅 노트 PDF 미리보기)
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Google Fonts CSS 허용 (layout.tsx에서 DM Sans/Cormorant Garamond 로드)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      // Google Fonts 웹폰트 파일 허용
      "font-src 'self' data: https://fonts.gstatic.com",
      isDev
        ? "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*"
        : "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // 같은 오리진 iframe 허용 (PDF 미리보기 iframe, blob URL 등)
      // 외부 도메인의 clickjacking 은 여전히 차단.
      "frame-ancestors 'self'",
    ];
    if (!isDev) cspDirectives.push('upgrade-insecure-requests');
    const csp = cspDirectives.join('; ');

    const baseHeaders = [
      // 클릭재킹 방어 — 외부 도메인 embed 차단, 같은 오리진만 허용
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // MIME sniffing 방어
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Referrer 최소화 (origin만 전달)
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // 기능 권한 최소화
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
      // Content Security Policy (XSS/data exfiltration 방어)
      { key: 'Content-Security-Policy', value: csp },
    ];

    // HSTS는 production에서만 (dev/localhost에서 활성화하면 브라우저가
    // 1년간 모든 localhost 요청을 https로 강제해서 dev 서버에 접속 불가)
    if (!isDev) {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [
      {
        source: '/:path*',
        headers: baseHeaders,
      },
    ];
  },
};

export default nextConfig;
