'use client';

// 고객 화면(목록·단골 카드) 헤더 — 왼쪽 워드마크(탭=매장 앱 메인), 오른쪽 매장명 + 앱 메뉴(⋮⋮⋮).
// 메뉴는 소믈리에 화면과 같은 SommelierMenu 재사용(재고 검색·입고·고객·로그아웃 등).
import { useEffect, useState } from 'react';
import { SommelierMenu } from '@/app/sommelier/components/SommelierMenu';
import { storeViewLabel, type StoreView } from '@/app/lib/store/types';
import { GOLD, GOLD_LINE, LAT } from '../../brand';

export function CustomerHeader() {
  const [view, setView] = useState<StoreView | null>(null);
  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setView(j?.storeView ?? null)).catch(() => {});
  }, []);
  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
        <a href="/sommelier" aria-label="매장 앱 메인으로" style={{ ...LAT, fontSize: 15, color: GOLD, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          CAVE DE VIN
        </a>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {view && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
              {storeViewLabel(view)}
            </span>
          )}
          <SommelierMenu />
        </span>
      </header>
      <div style={{ height: 1, background: GOLD_LINE, margin: '10px -16px 20px' }} />
    </>
  );
}
