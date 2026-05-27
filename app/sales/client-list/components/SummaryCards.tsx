'use client';

import { fmt } from '../lib/format';

type Props = {
  totalClients: number;
  totalSupply: number;
  totalAmount: number;
};

/**
 * 3 컬럼 stat 카드. 모든 페이지에서 동일한 stat 패턴 사용.
 */
export function SummaryCards({ totalClients, totalSupply, totalAmount }: Props) {
  const cards = [
    { label: '거래처 수', value: fmt(totalClients), unit: '개', accent: false },
    { label: '공급가 합계', value: fmt(totalSupply), unit: '원', accent: false },
    { label: '총액 합계', value: fmt(totalAmount), unit: '원', accent: true },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
              fontSize: 22,
              fontWeight: 700,
              color: card.accent ? 'var(--action)' : 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {card.value}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>
              {card.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
