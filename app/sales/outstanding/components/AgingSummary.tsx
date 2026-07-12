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

  // 스탯 스트립 — 박스 없이 상하 헤어라인 + 세로 구분. 상태는 숫자 색으로만.
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', overflowX: 'auto',
      borderTop: '1px solid var(--border-default)',
      borderBottom: '1px solid var(--border-default)',
    }}>
      {cards.map((c, i) => (
        <div key={c.label} style={cellStyle(i > 0)}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {c.label}
          </div>
          <div style={{
            fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 3, letterSpacing: '-0.01em',
            color: c.danger ? 'var(--status-danger)' : c.warn ? 'var(--status-warning)' : c.good ? 'var(--status-success)' : 'var(--text-primary)',
          }}>
            {fmt(c.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function cellStyle(divider: boolean): CSSProperties {
  return {
    flex: '1 0 auto',
    minWidth: 110,
    padding: '12px 16px',
    borderLeft: divider ? '1px solid var(--border-default)' : 'none',
  };
}
