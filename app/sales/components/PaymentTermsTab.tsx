'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePaymentTerms } from '../payment-terms/hooks/usePaymentTerms';
import { PaymentTermRow } from '../payment-terms/components/PaymentTermRow';
import type { OutstandingType } from '../outstanding/types';
import { Stack } from '@/app/components/ui';

type Props = { currentManager: string; isAdmin: boolean; initialManagers?: string[] };
type SetFilter = 'all' | 'unset' | 'set';

const MAX_RENDER = 300;

export default function PaymentTermsTab({ currentManager, isAdmin, initialManagers }: Props) {
  const [type, setType] = useState<OutstandingType>('wine');
  const [selectedManager, setSelectedManager] = useState(currentManager);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SetFilter>('all');

  const manager = isAdmin ? selectedManager : currentManager;
  const { loading, error, rows, savingCode, saveTerm } = usePaymentTerms({ manager, type });

  const setCount = rows.filter(r => r.payment_type).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'set' && !r.payment_type) return false;
      if (filter === 'unset' && r.payment_type) return false;
      if (q && !r.client_name.toLowerCase().includes(q) && !r.client_code.includes(q)) return false;
      return true;
    });
  }, [rows, search, filter]);

  const shown = filtered.slice(0, MAX_RENDER);

  return (
    <Stack direction="vertical" gap={14}>
      {/* 법인 토글 + (관리자) 매니저 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          {([['wine', '까브드뱅'], ['glass', '대유라이프']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setType(v)} style={segBtn(type === v)}>{label}</button>
          ))}
        </div>
        {isAdmin && initialManagers && (
          <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} style={selStyle}>
            {initialManagers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          전체 {rows.length} · 설정 {setCount} · 미설정 {rows.length - setCount}
        </span>
      </div>

      {/* 검색 + 설정 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="거래처명 검색" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...selStyle, flex: '1 1 220px', minWidth: 180 }}
        />
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {([['all', '전체'], ['unset', '미설정'], ['set', '설정됨']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)} style={chip(filter === v)}>{label}</button>
          ))}
        </div>
      </div>

      {/* 규칙 안내 */}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--surface-muted)', borderRadius: 8 }}>
        말일 = 입고월 마지막 평일(주말이면 직전 평일) · 익월N = 익월 N일(주말이면 직후 평일) · 선결제 = 예정일 없음
      </div>

      {error && <div style={errBox}>{error}</div>}
      {loading && <div style={emptyBox}>불러오는 중…</div>}

      {!loading && !error && (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
          {shown.map(r => (
            <PaymentTermRow
              key={r.client_code}
              clientCode={r.client_code}
              clientName={r.client_name}
              paymentType={r.payment_type}
              saving={savingCode === r.client_code}
              onSelect={saveTerm}
            />
          ))}
          {filtered.length === 0 && <div style={emptyBox}>거래처가 없습니다.</div>}
          {filtered.length > MAX_RENDER && (
            <div style={{ ...emptyBox, fontSize: 12 }}>
              {filtered.length.toLocaleString()}곳 중 {MAX_RENDER}곳 표시 — 검색으로 좁혀주세요.
            </div>
          )}
        </div>
      )}
    </Stack>
  );
}

function segBtn(active: boolean): CSSProperties {
  return {
    padding: '6px 14px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? 'var(--action)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-secondary)',
  };
}
function chip(active: boolean): CSSProperties {
  return {
    padding: '6px 12px', fontSize: 13, fontWeight: active ? 700 : 500, borderRadius: 7, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--action)' : 'var(--border-default)'}`,
    background: active ? 'rgba(139,21,56,0.06)' : 'var(--surface)',
    color: active ? 'var(--action)' : 'var(--text-secondary)',
  };
}
const selStyle: CSSProperties = {
  padding: '7px 10px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border-default)', background: 'var(--surface)', color: 'var(--text-primary)',
};
const errBox: CSSProperties = {
  padding: '10px 14px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.18)',
  borderRadius: 8, fontSize: 13, color: '#dc2626',
};
const emptyBox: CSSProperties = {
  textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface)',
};
