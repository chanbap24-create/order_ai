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
  // 스탯 스트립 — 박스 없이 상하 헤어라인 + 세로 구분 (브리핑·미수와 동일 문법)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        overflowX: 'auto',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {cards.map((card, i) => (
        <div
          key={card.label}
          style={{
            flex: 1,
            minWidth: 130,
            padding: '14px 18px',
            borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              marginBottom: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
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
