'use client';

import type { CSSProperties } from 'react';
import type { AgingRow } from '../types';
import { fmt } from '../lib/format';

// 연령별 합계 요약 카드 (0-30 / 31-60 / 61-90 / 90+ / 미수총액)
export function AgingSummary({ rows }: { rows: AgingRow[] }) {
  const t = rows.reduce(
    (a, r) => ({
      net: a.net + r.net_balance,
      cur: a.cur + r.b_cur,
      m1: a.m1 + r.b_m1,
      m2: a.m2 + r.b_m2,
      m3: a.m3 + r.b_m3,
      paid: a.paid + r.paid_90d,
    }),
    { net: 0, cur: 0, m1: 0, m2: 0, m3: 0, paid: 0 },
  );

  const cards: Array<{ label: string; value: number; danger?: boolean; warn?: boolean; good?: boolean }> = [
    { label: '미수 총액', value: t.net },
    { label: '당월', value: t.cur },
    { label: '1개월', value: t.m1 },
    { label: '2개월', value: t.m2, warn: true },
    { label: '3개월+', value: t.m3, danger: true },
    { label: '최근3개월 수금', value: t.paid, good: true },
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
            color: c.danger ? '#dc2626' : c.warn ? '#d97706' : c.good ? '#16a34a' : 'var(--text-primary)',
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
