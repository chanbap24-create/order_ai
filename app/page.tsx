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
          fontFamily: "'DM Sans', -apple-system, sans-serif",
          wordBreak: 'keep-all',
        }}
      >
        <div
          className="home-content"
          style={{
            background: 'var(--surface-muted)',
            overflowY: 'auto',
            position: 'relative',
            minHeight: 'inherit',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 200,
            background: 'linear-gradient(180deg, rgba(90, 21, 21, 0.02) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          <div style={{ maxWidth: 640, position: 'relative', zIndex: 1 }}>
            <div style={{
              marginBottom: 48,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s',
            }}>
              <p style={{
                fontSize: '0.7rem', color: '#5A1515',
                letterSpacing: '0.2em', textTransform: 'uppercase',
                fontWeight: 600, marginBottom: 12,
              }}>
                Dashboard
              </p>
              <h2 className="home-heading" style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.8rem', fontWeight: 400,
                color: '#1a1a2e', letterSpacing: '-0.01em',
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
