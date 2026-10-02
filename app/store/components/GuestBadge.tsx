'use client';

// 지금 응대 중인 손님 표시 — 세션 손님(cartSession)을 읽어 '● 조성재 님'. 익명(미동의)이면 아무것도 안 그림.
// 재고 앱 헤더·소믈리에 문답/결과 헤더 공용.
import { useState } from 'react';
import { readGuest } from '@/app/lib/store/cartSession';

export function GuestBadge({ name, sep }: { name?: string; sep?: boolean }) {
  // 로그인 확인 뒤에만 마운트되는 클라이언트 화면이라 초기값에서 바로 읽어도 하이드레이션 불일치 없음
  const [stored] = useState(() => readGuest()?.name || '');
  const guest = name || stored;
  if (!guest) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      <i aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#b89a6a', flex: 'none' }} />
      {guest} 님
      {sep && <span aria-hidden style={{ color: 'var(--text-muted)', margin: '0 2px 0 4px' }}>·</span>}
    </span>
  );
}
