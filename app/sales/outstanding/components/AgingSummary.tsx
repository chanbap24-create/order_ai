'use client';

import type { CSSProperties } from 'react';
import type { AgingRow } from '../types';
import { fmt } from '../lib/format';

// 연령별 합계 요약 카드 (0-30 / 31-60 / 61-90 / 90+ / 미수총액)
export function AgingSummary({ rows }: { rows: AgingRow[] }) {
  const t = rows.reduce(
    (a, r) => ({
      net: a.net + r.net_balance,
      b0: a.b0 + r.b_0_30,
      b1: a.b1 + r.b_31_60,
      b2: a.b2 + r.b_61_90,
      b3: a.b3 + r.b_90plus,
    }),
    { net: 0, b0: 0, b1: 0, b2: 0, b3: 0 },
  );

  const cards: Array<{ label: string; value: number; danger?: boolean; warn?: boolean }> = [
    { label: '미수 총액', value: t.net },
    { label: '0–30일', value: t.b0 },
    { label: '31–60일', value: t.b1 },
    { label: '61–90일', value: t.b2, warn: true },
    { label: '90일+', value: t.b3, danger: true },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
      {cards.map(c => (
        <div key={c.label} style={cardStyle(c.danger, c.warn)}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.03em' }}>
            {c.label}
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 4,
            color: c.danger ? '#dc2626' : c.warn ? '#d97706' : 'var(--text-primary)',
          }}>
            {fmt(c.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function cardStyle(danger?: boolean, warn?: boolean): CSSProperties {
  return {
    padding: '12px 14px',
    borderRadius: 10,
    background: danger ? 'rgba(220,38,38,0.05)' : warn ? 'rgba(217,119,6,0.05)' : 'var(--surface)',
    border: `1px solid ${danger ? 'rgba(220,38,38,0.22)' : warn ? 'rgba(217,119,6,0.22)' : 'var(--border-default)'}`,
  };
}
