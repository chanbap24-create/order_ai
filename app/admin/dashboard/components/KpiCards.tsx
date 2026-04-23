'use client';

import Card from '@/app/components/ui/Card';
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

export function KpiCards(p: Props) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600 }}>총 매출</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#8B1538' }}>
            {p.hasAnalysis ? formatKrw(p.totalRevenue) : '-'}
          </div>
          {p.hasAnalysis && (
            <div style={{ fontSize: 10, color: 'var(--color-text-lighter)', marginTop: 2 }}>
              {new Date().getFullYear()}년 누적
            </div>
          )}
        </Card>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 4, fontWeight: 600 }}>총 재고금액</div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text)' }}>
            {formatKrw(p.totalInventory)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-lighter)', marginTop: 2 }}>CDV + DL</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 2, fontWeight: 600, letterSpacing: '0.05em' }}>
            CDV (까브드뱅)
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: '#5A1515' }}>
            {formatKrw(p.cdvValue)}원
          </div>
          <ChangeIndicator change={p.cdvChange} />
        </Card>
        <Card size="sm" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-lighter)', marginBottom: 2, fontWeight: 600, letterSpacing: '0.05em' }}>
            DL (대유라이프)
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: '#2563eb' }}>
            {formatKrw(p.dlValue)}원
          </div>
          <ChangeIndicator change={p.dlChange} />
        </Card>
      </div>
    </>
  );
}

function ChangeIndicator({ change }: { change: InventoryChange | null }) {
  if (!change || change.amount === 0) return null;
  const isUp = change.amount > 0;
  const arrow = isUp ? '▲' : '▼';
  const color = isUp ? '#E53E3E' : '#3182CE';

  return (
    <div style={{ marginTop: 6, fontSize: 'var(--text-sm)', color, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <span>{arrow} {formatChangeKrw(change.amount)}원</span>
      <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
        ({isUp ? '+' : ''}{change.rate.toFixed(1)}%)
      </span>
    </div>
  );
}
