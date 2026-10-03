'use client';

// 고객 목록 — 매장 앱 메뉴 '고객'. 이름 검색 + 최근 방문 순 목록, 탭하면 단골 카드.
// 보기 범위는 서버(세션) 기준: 박경아·조성재·admin은 전체, 그 외는 본인이 등록한 고객만.
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
import { RoundBackButton } from '@/app/components/RoundBackButton';
import { GOLD, GOLD_LINE, LAT, fmt } from '../brand';
import type { CustomerListRow } from '@/app/lib/sommelierCustomerCard';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerListRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/sommelier/customers?q=${encodeURIComponent(q.trim())}`)
        .then(async (r) => { const j = await r.json(); if (r.ok) { setRows(j.customers || []); setError(''); } else setError(j.error || '불러오지 못했습니다.'); })
        .catch(() => setError('네트워크를 확인하세요.'));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px calc(96px + env(safe-area-inset-bottom))', color: 'var(--text-primary)' }}>
      <div style={{ ...LAT, fontSize: 11, color: GOLD }}>GUESTS</div>
      <h1 style={{ margin: '10px 0 0', fontSize: '1.5rem', fontWeight: 500 }}>고객</h1>
      <div style={{ height: 1, background: GOLD_LINE, margin: '14px -16px 16px' }} />

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름으로 찾기" inputMode="search"
        style={{
          width: '100%', boxSizing: 'border-box', height: 46, padding: '0 18px', fontSize: 16, borderRadius: 999,
          border: '1px solid var(--border-subtle)', background: 'var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', outline: 'none',
          color: 'var(--text-primary)',
        }} />

      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 20, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{q.trim() ? '검색 결과' : '최근 방문 순'}</span>
        {rows && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>{rows.length}명</span>}
      </div>

      {error && <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--status-danger)' }}>{error}</p>}
      {!rows && !error && <ListSkeleton rows={6} />}
      {rows && rows.length === 0 && (
        <p style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          {q.trim() ? '찾는 손님이 없어요' : '아직 등록한 손님이 없어요'}
        </p>
      )}
      {(rows || []).map((c) => (
        <a key={c.id} href={`/store/customer/${c.id}?from=customers`}
          style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 2px', borderBottom: '1px solid var(--border-subtle)', color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
          <span style={{ flex: 'none', fontSize: 15, fontWeight: 600 }}>{c.name}</span>
          <span style={{ flex: 'none', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{c.phoneMasked}</span>
          {c.marketing && <i title="마케팅 수신 동의" style={{ flex: 'none', alignSelf: 'center', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />}
          <span style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {c.purchases > 0 ? `구매 ${c.purchases}회 · ${fmt(c.amount)}원` : '구매 없음'}
            <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-tertiary)' }}>{c.lastVisit.replace(/-/g, '.')} 방문</span>
          </span>
        </a>
      ))}

      <RoundBackButton onClick={() => { window.location.href = '/store'; }}
        style={{ position: 'fixed', left: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 41 }} />
    </div>
  );
}
