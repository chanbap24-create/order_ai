'use client';

import { memo } from 'react';
import type { DashboardStats, InventoryChange } from '@/app/types/wine';
import { formatChangeKrw, formatKrw } from '../lib/format';

type Props = {
  totalRevenue: number;
  totalInventory: number;
  hasAnalysis: boolean;
  cdvValue: number;
  dlValue: number;
  cdvChange: DashboardStats['cdvChange'];
  dlChange: DashboardStats['dlChange'];
};

/**
 * KPI 스탯 스트립 — KREAM 문법(박스 없이 상하 헤어라인 + 세로 구분, 좌측 정렬).
 * 총매출 · 총재고 · 까브드뱅 · 대유라이프 한 줄. 증감은 색 숫자로.
 */
export const KpiCards = memo(function KpiCards(p: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        overflowX: 'auto',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 16,
      }}
    >
      <Cell
        label="총 매출"
        value={p.hasAnalysis ? formatKrw(p.totalRevenue) : '-'}
        sub={p.hasAnalysis ? `${new Date().getFullYear()}년 누적` : undefined}
      />
      <Cell
        label="총 재고금액"
        value={formatKrw(p.totalInventory)}
        sub="까브드뱅 + 대유라이프"
        divider
      />
      <Cell
        label="까브드뱅 재고"
        value={`${formatKrw(p.cdvValue)}원`}
        change={p.cdvChange}
        divider
      />
      <Cell
        label="대유라이프 재고"
        value={`${formatKrw(p.dlValue)}원`}
        change={p.dlChange}
        divider
      />
    </div>
  );
});

function Cell({
  label,
  value,
  sub,
  change,
  divider,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: InventoryChange | null;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        flex: '1 0 auto',
        minWidth: 160,
        padding: '14px 18px',
        borderLeft: divider ? '1px solid var(--border-default)' : 'none',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {change ? (
        <ChangeIndicator change={change} />
      ) : sub ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap' }}>{sub}</div>
      ) : null}
    </div>
  );
}

function ChangeIndicator({ change }: { change: InventoryChange | null }) {
  if (!change || change.amount === 0) return null;
  const isUp = change.amount > 0;
  const arrow = isUp ? '▲' : '▼';
  const color = isUp ? 'var(--status-danger)' : 'var(--status-info)';

  return (
    <div
      style={{
        marginTop: 3,
        fontSize: 12,
        color,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      <span>
        {arrow} {formatChangeKrw(change.amount)}원
      </span>
      <span style={{ fontSize: 11, opacity: 0.8 }}>
        ({isUp ? '+' : ''}
        {change.rate.toFixed(1)}%)
      </span>
    </div>
  );
}
