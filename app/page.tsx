'use client';

import { useEffect, useState } from 'react';
import { HOME_STYLES } from './home/homeStyles';
import { HomeCards } from './home/HomeCards';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style>{HOME_STYLES}</style>

      <div
        className="home-page-root"
        style={{
          minHeight: 'calc(100vh - 56px)',
          // 배경은 풀블리드(루트) — 콘텐츠 컬럼에만 깔면 body(#fff)와 이음새가 보임
          background: 'var(--surface-muted)',
          wordBreak: 'keep-all',
        }}
      >
        <div
          className="home-content"
          style={{
            overflowY: 'auto',
            position: 'relative',
            minHeight: 'inherit',
          }}
        >
          <div style={{ maxWidth: 720, position: 'relative', zIndex: 1 }}>
            <div style={{
              marginBottom: 36,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s',
            }}>
              <p style={{
                fontSize: '0.7rem', color: 'var(--action)',
                letterSpacing: '0.2em', textTransform: 'uppercase',
                fontWeight: 600, marginBottom: 12,
              }}>
                Dashboard
              </p>
              <h2 className="home-heading" style={{
                fontSize: '1.8rem', fontWeight: 400,
                color: 'var(--text-primary)', letterSpacing: '-0.01em',
                lineHeight: 1.3, marginBottom: 8,
              }}>
                무엇을 도와드릴까요?
              </h2>
              <p className="home-sub-text" style={{
                fontSize: '0.85rem', color: '#8E8E93', lineHeight: 1.6,
              }}>
                재고 확인, 견적 작성, 발주 생성, 거래처 분석 중 선택하세요.
              </p>
            </div>

            <HomeCards mounted={mounted} />
          </div>
        </div>
      </div>
    </>
  );
}
