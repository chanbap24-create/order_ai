'use client';

import type { CSSProperties } from 'react';
import type { AgingRow } from '../types';
import { fmt } from '../lib/format';

// 연령별 합계 요약 카드 (미수총액 / 당월·1·2·3개월+ / 최근3개월 수금)
// recentPaymentTotal: 완납 거래처까지 포함한 매니저 전체 수금 합계(표 합산은 미수 잔존분만이라 과소집계됨).
export function AgingSummary({ rows, recentPaymentTotal }: { rows: AgingRow[]; recentPaymentTotal?: number | null }) {
  const t = rows.reduce(
    (a, r) => ({
      net: a.net + r.net_balance,
      over: a.over + r.overdue,
      cur: a.cur + r.b_cur,
      m1: a.m1 + r.b_m1,
      m2: a.m2 + r.b_m2,
      m3: a.m3 + r.b_m3,
      paid: a.paid + r.paid_90d,
    }),
    { net: 0, over: 0, cur: 0, m1: 0, m2: 0, m3: 0, paid: 0 },
  );
  // 전체 수금 합계가 있으면 그 값을, 없으면 표 합산 fallback.
  const paidTotal = recentPaymentTotal != null ? recentPaymentTotal : t.paid;

  const cards: Array<{ label: string; value: number; danger?: boolean; warn?: boolean; good?: boolean }> = [
    { label: '미수 총액', value: t.net },
    { label: '연체(예정일 경과)', value: t.over, danger: true },
    { label: '당월', value: t.cur },
    { label: '1개월', value: t.m1 },
    { label: '2개월', value: t.m2, warn: true },
    { label: '3개월+', value: t.m3, danger: true },
    { label: '최근3개월 수금', value: paidTotal, good: true },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
      {cards.map(c => (
        <div key={c.label} style={cardStyle(c.danger, c.warn, c.good)}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.03em' }}>
            {c.label}
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 4,
            color: c.danger ? 'var(--status-danger)' : c.warn ? 'var(--status-warning)' : c.good ? 'var(--status-success)' : 'var(--text-primary)',
          }}>
            {fmt(c.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function cardStyle(danger?: boolean, warn?: boolean, good?: boolean): CSSProperties {
  const tint = danger ? '220,38,38' : warn ? '217,119,6' : good ? '22,163,74' : null;
  return {
    padding: '12px 14px',
    borderRadius: 10,
    background: tint ? `rgba(${tint},0.05)` : 'var(--surface)',
    border: `1px solid ${tint ? `rgba(${tint},0.22)` : 'var(--border-default)'}`,
  };
}
