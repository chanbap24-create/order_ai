'use client';

import { memo } from 'react';
import type { AnalysisData } from '../types';
import { formatKrw } from '../lib/format';

/**
 * 7개 stat 요약 — KREAM 스탯 스트립(박스 없이 상하 헤어라인 + 세로 구분).
 * label 11 / value 19 / sub 11. 강조(총 매출)만 action, 상태는 숫자 색으로만.
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
        display: 'flex',
        alignItems: 'stretch',
        overflowX: 'auto',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 20,
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            flex: '1 0 auto',
            minWidth: 110,
            padding: '12px 16px',
            borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {c.label}
          </div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: c.danger
                ? 'var(--status-danger)'
                : c.accent
                  ? 'var(--action)'
                  : 'var(--text-primary)',
              lineHeight: 1.2,
              marginTop: 3,
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
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
                whiteSpace: 'nowrap',
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
