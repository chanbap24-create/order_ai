import type { ReactNode } from 'react';

export interface HomeCard {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  desc: string;
  icon: ReactNode;
}

export const HOME_CARDS: HomeCard[] = [
  {
    id: 'inventory',
    href: '/inventory',
    title: 'Inventory & Quote',
    subtitle: '재고 조회 + 견적서 작성',
    desc: 'CDV · DL 재고 검색, 견적 바스켓에 추가, 엑셀 출력까지 한번에',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'sales',
    href: '/sales',
    title: 'Sales',
    subtitle: '영업 지원',
    desc: '미팅 관리, AI 브리핑, 매출 분석, 거래처 추천',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'order',
    href: '/order-v2',
    title: 'Order',
    subtitle: '와인 / 리델 발주',
    desc: 'AI 파싱 기반 자동 발주서 생성 시스템',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
        <line x1="9" y1="18" x2="13" y2="18" />
      </svg>
    ),
  },
  {
    id: 'marketing',
    href: '/marketing',
    title: 'Marketing',
    subtitle: '판매 분석 · 수입량 예측',
    desc: '브랜드별 매출, 국가/지역/타입별 분석, 수입량 예측',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21H4.6c-.56 0-.84 0-1.054-.109a1 1 0 0 1-.437-.437C3 20.24 3 19.96 3 19.4V3" />
        <path d="M7 14l4-4 4 4 6-6" />
      </svg>
    ),
  },
];
