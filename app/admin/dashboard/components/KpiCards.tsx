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

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
  padding: '12px 14px',
  textAlign: 'center',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-tertiary)',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

export const KpiCards = memo(function KpiCards(p: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* 상단 2개: 총 매출 / 총 재고금액 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={cardStyle}>
          <div style={labelStyle}>총 매출</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--action)',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {p.hasAnalysis ? formatKrw(p.totalRevenue) : '-'}
          </div>
          {p.hasAnalysis && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {new Date().getFullYear()}년 누적
            </div>
          )}
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>총 재고금액</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatKrw(p.totalInventory)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            까브드뱅 + 대유라이프
          </div>
        </div>
      </div>

      {/* 하단 2개: 까브드뱅 / 대유라이프 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <div style={cardStyle}>
          <div style={labelStyle}>까브드뱅</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--action)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {formatKrw(p.cdvValue)}원
          </div>
          <ChangeIndicator change={p.cdvChange} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>대유라이프</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--status-info)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {formatKrw(p.dlValue)}원
          </div>
          <ChangeIndicator change={p.dlChange} />
        </div>
      </div>
    </div>
  );
});

function ChangeIndicator({ change }: { change: InventoryChange | null }) {
  if (!change || change.amount === 0) return null;
  const isUp = change.amount > 0;
  const arrow = isUp ? '▲' : '▼';
  const color = isUp ? 'var(--status-danger)' : 'var(--status-info)';

  return (
    <div
      style={{
        marginTop: 6,
        fontSize: 12,
        color,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontVariantNumeric: 'tabular-nums',
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
