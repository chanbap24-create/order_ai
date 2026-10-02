'use client';

// 뒤로 원형 버튼 — 매장 재고 앱 하단 플로팅 · 소믈리에 손님 정보/문답 하단 줄 공용.
// 흰 바탕 + 얇은 테두리 + 은은한 그림자, 가운데 ‹ 아이콘.
import type { CSSProperties } from 'react';

export function RoundBackButton({ onClick, label = '뒤로', style }: { onClick: () => void; label?: string; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{
        width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-primary)', cursor: 'pointer', flex: 'none', padding: 0, ...style,
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  );
}
