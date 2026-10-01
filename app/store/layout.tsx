import type { Metadata, Viewport } from 'next';

// 점장 매장 앱 (/store) — 독립 PWA. 앱 네비 없음(Navigation에서 제외), 홈 화면 추가 설치형.
export const metadata: Metadata = {
  title: '까브 매장',
  description: '까브드뱅 백화점 매장 재고 확인',
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
  maximumScale: 1, // 매장에서 한 손 사용 — 핀치줌 대신 고정 레이아웃
  themeColor: '#111214',
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100dvh', background: 'var(--surface)' }}>{children}</div>;
}
