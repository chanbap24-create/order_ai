'use client';

// 지금 응대 중인 손님 표시 — 세션 손님(cartSession)을 읽어 '● 조성재 님'. 익명(미동의)이면 아무것도 안 그림.
// 재고 앱 헤더·소믈리에 문답/결과 헤더 공용. 누르면 그 손님의 단골 카드.
import { useState } from 'react';
import { readGuest } from '@/app/lib/store/cartSession';
import { GOLD } from '../brand';

export function GuestBadge({ name, sep }: { name?: string; sep?: boolean }) {
  // 로그인 확인 뒤에만 마운트되는 클라이언트 화면이라 초기값에서 바로 읽어도 하이드레이션 불일치 없음
  const [g] = useState(() => readGuest());
  const guest = name || g?.name || '';
  if (!guest) return null;
  const openCard = () => {
    if (!g?.id) return;
    const from = window.location.pathname.startsWith('/sommelier') ? 'sommelier' : 'store';
    window.location.href = `/store/customer/${g.id}?from=${from}`;
  };
  return (
    <span role={g?.id ? 'link' : undefined} tabIndex={g?.id ? 0 : undefined} aria-label={g?.id ? `${guest} 님 단골 카드` : undefined}
      onClick={openCard} onKeyDown={(e) => { if (e.key === 'Enter') openCard(); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: g?.id ? 'pointer' : 'default' }}>
      <i aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, flex: 'none' }} />
      <span style={{ textDecoration: g?.id ? 'underline' : 'none', textUnderlineOffset: 3, textDecorationColor: 'var(--border-default)' }}>{guest} 님</span>
      {sep && <span aria-hidden style={{ color: 'var(--text-muted)', margin: '0 2px 0 4px' }}>·</span>}
    </span>
  );
}
