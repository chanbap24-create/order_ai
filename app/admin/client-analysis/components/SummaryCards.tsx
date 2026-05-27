'use client';

import { memo } from 'react';
import type { AnalysisData } from '../types';
import { formatKrw } from '../lib/format';

/**
 * 7개 stat 카드 — 다른 페이지 stat 카드와 동일 사양.
 * label uppercase 11 / value 20 / sub 11. 강조(총 매출)만 burgundy.
 */
export const SummaryCards = memo(function SummaryCards({ data }: { data: AnalysisData }) {
  const s = data.summary;
  const avgPerClient =
    s.distinctClients > 0 ? Math.round(s.totalRevenue / s.distinctClients) : 0;
  const returnRate =
    s.positiveRevenue > 0
      ? Math.round((s.returnAmount / s.positiveRevenue) * 1000) / 10
      : 0;

  // 평균 지원률 — RPC summary.avgDiscount (전체 거래 가중 평균).
  // 세일즈 분석과 동일 계산 방식.
  const discountRate =
    s.avgDiscount != null && s.avgDiscount > 0 ? s.avgDiscount : null;

  const cards: Array<{
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
    danger?: boolean;
  }> = [
    { label: '총 매출', value: formatKrw(s.totalRevenue), accent: true },
    { label: '활동 거래처', value: `${s.distinctClients.toLocaleString()}곳` },
    { label: '객단가', value: formatKrw(avgPerClient), sub: '거래처당 평균' },
    { label: '매출 집중도', value: `${s.top10Pct}%`, sub: '상위 10%' },
    { label: '재주문율', value: `${s.repeatRate}%`, sub: '2개월↑ 주문' },
    {
      label: '반품률',
      value: `${returnRate}%`,
      sub: formatKrw(s.returnAmount),
      danger: returnRate > 10,
    },
    {
      label: '평균 지원률',
      value: discountRate != null ? `${discountRate}%` : '-',
      sub: '거래 가중평균',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        marginBottom: 20,
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '12px 14px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {c.label}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: c.danger
                ? '#C62828'
                : c.accent
                  ? 'var(--action)'
                  : 'var(--text-primary)',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {c.value}
          </div>
          {c.sub && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 3,
              }}
            >
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
