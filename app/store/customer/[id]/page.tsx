'use client';

// 단골 카드 페이지 — /store/customer/[id]?from=sommelier|store. 데이터 로드·버튼 동작만, 화면은 CustomerCard.
import { use, useEffect, useState } from 'react';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerHeader } from '../components/CustomerHeader';
import type { CustomerCardData } from '../types';
import { ListSkeleton, StatStripSkeleton } from '@/app/components/ui/Skeleton';
import { readGuest, startGuestSession, syncGuest } from '@/app/lib/store/cartSession';

export default function CustomerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [card, setCard] = useState<CustomerCardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/sommelier/customer/${encodeURIComponent(id)}/card`)
      .then(async (r) => { const j = await r.json(); if (r.ok) setCard(j.card); else setError(j.error || '불러오지 못했습니다.'); })
      .catch(() => setError('네트워크를 확인하세요.'));
  }, [id]);

  const from = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('from') : null;
  const back = () => { window.location.href = from === 'sommelier' ? '/sommelier?resume=1' : from === 'customers' ? '/store/customers' : '/store'; };
  // 이 손님을 응대 중으로 — 이미 같은 손님이면 카트 유지, 다른 손님이면 새 응대(카트 비움)
  const serveAs = (c: CustomerCardData) => {
    const g = readGuest();
    if (g?.id === c.id) syncGuest({ id: c.id, name: c.name }); else startGuestSession({ id: c.id, name: c.name });
  };

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px', textAlign: 'center' }}>
        <CustomerHeader />
        <p style={{ marginTop: '25vh', fontSize: 14, color: 'var(--text-secondary)' }}>{error}</p>
        <button onClick={back} style={{ all: 'unset', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}>돌아가기</button>
      </div>
    );
  }
  if (!card) {
    return <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px' }}><CustomerHeader /><StatStripSkeleton cells={5} /><ListSkeleton rows={8} /></div>;
  }
  return (
    <CustomerCard d={card} onBack={back}
      onServe={() => { serveAs(card); window.location.href = '/store'; }}
      onRecommend={() => {
        // 구매 취향으로 채운 답변을 소믈리에에 넘겨 문답 없이 바로 추천 결과로
        serveAs(card);
        try { sessionStorage.setItem('cave_som_auto', JSON.stringify(card.suggested)); } catch { /* ignore */ }
        window.location.href = '/sommelier?auto=1';
      }}
      onSaveProfile={async (profile) => {
        const r = await fetch(`/api/sommelier/customer/${card.id}/card`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }),
        }).catch(() => null);
        if (!r?.ok) { alert((await r?.json().catch(() => null))?.error || '저장에 실패했습니다.'); return false; }
        return true;
      }}
      onSaveMemo={async (memo) => {
        const r = await fetch(`/api/sommelier/customer/${card.id}/card`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo }),
        }).catch(() => null);
        if (!r?.ok) { alert('메모 저장에 실패했습니다.'); return false; }
        const j = await (await fetch(`/api/sommelier/customer/${card.id}/card`)).json();
        if (j.card) setCard(j.card);
        return true;
      }} />
  );
}
