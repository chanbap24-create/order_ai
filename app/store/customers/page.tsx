'use client';

// 고객 목록 — 매장 앱 메뉴 '고객'. 이름 검색 + 최근 등록(7일)·최근 방문 순 목록, 탭하면 단골 카드.
// 보기 범위는 서버(세션) 기준: 박경아·조성재·admin은 전체, 그 외는 본인이 등록한 고객만.
import { useState } from 'react';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
import { RoundBackButton } from '@/app/components/RoundBackButton';
import { CustomerHeader } from '../customer/components/CustomerHeader';
import { fmt } from '../brand';
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import type { CustomerListRow } from '@/app/lib/sommelierCustomerCard';

function SectionHead({ title, sub, count, gap }: { title: string; sub?: string; count?: number; gap?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: gap ? 28 : 20, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</span>}
      {count != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{count}명</span>}
    </div>
  );
}

function CustomerRow({ c, showRegistered }: { c: CustomerListRow; showRegistered?: boolean }) {
  return (
    <a href={`/store/customer/${c.id}?from=customers`}
      style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 2px', borderBottom: '1px solid var(--border-subtle)', color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
      <span style={{ flex: 'none', fontSize: 15, fontWeight: 600 }}>{c.name}</span>
      <span style={{ flex: 'none', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{c.phoneMasked}</span>
      {c.marketing && <i title="마케팅 수신 동의" style={{ flex: 'none', alignSelf: 'center', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }} />}
      <span style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {c.purchases > 0 ? `구매 ${c.purchases}회 · ${fmt(c.amount)}원` : '구매 없음'}
        <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-tertiary)' }}>
          {showRegistered ? `${c.registered.replace(/-/g, '.')} 등록` : `${c.lastVisit.replace(/-/g, '.')} 방문`}
        </span>
      </span>
    </a>
  );
}

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const { rows, error } = useCustomerSearch(q);
  const searching = !!q.trim();
  const fresh = !searching && rows ? [...rows].filter((c) => c.isNew).sort((a, b) => b.registered.localeCompare(a.registered) || b.id - a.id) : [];
  const rest = rows ? rows.filter((c) => searching || !c.isNew) : [];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px calc(96px + env(safe-area-inset-bottom))', color: 'var(--text-primary)' }}>
      <CustomerHeader />

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="어떤 손님을 찾으세요?" inputMode="search"
        style={{
          width: '100%', boxSizing: 'border-box', height: 46, padding: '0 18px', fontSize: 16, borderRadius: 999,
          border: '1px solid var(--border-subtle)', background: 'var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', outline: 'none',
          color: 'var(--text-primary)',
        }} />

      {error && <p style={{ padding: '20px 0', fontSize: 13, color: 'var(--status-danger)' }}>{error}</p>}
      {!rows && !error && <><SectionHead title={searching ? '검색 결과' : '최근 방문 순'} /><ListSkeleton rows={6} /></>}
      {rows && rows.length === 0 && (
        <>
          <SectionHead title={searching ? '검색 결과' : '최근 방문 순'} count={0} />
          <p style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            {searching ? '찾는 손님이 없어요' : '아직 등록한 손님이 없어요'}
          </p>
        </>
      )}
      {/* 검색 중이 아니면 최근 7일 안에 등록한 손님을 맨 위에 따로 */}
      {fresh.length > 0 && (
        <>
          <SectionHead title="최근 등록" sub="7일" count={fresh.length} />
          {fresh.map((c) => <CustomerRow key={c.id} c={c} showRegistered />)}
        </>
      )}
      {rest.length > 0 && (
        <>
          <SectionHead title={searching ? '검색 결과' : '최근 방문 순'} count={rest.length} gap={fresh.length > 0} />
          {rest.map((c) => <CustomerRow key={c.id} c={c} />)}
        </>
      )}

      <RoundBackButton onClick={() => { window.location.href = '/store'; }}
        style={{ position: 'fixed', left: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 41 }} />
    </div>
  );
}
