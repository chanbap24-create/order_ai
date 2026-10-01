import type { Metadata, Viewport } from 'next';

// 소믈리에 — 매장 PWA의 메인 화면. /store와 같은 manifest를 걸어
// 어느 쪽에서 접속해도 홈 화면 설치가 가능하다 (scope '/', 시작점 /sommelier).
export const metadata: Metadata = {
  title: '까브 매장',
  description: '까브드뱅 백화점 매장 — 소믈리에 · 재고 확인',
  manifest: '/store/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '까브 매장',
  },
  icons: {
    apple: '/store/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default function SommelierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
