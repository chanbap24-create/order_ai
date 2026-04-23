'use client';

import { memo, useCallback } from 'react';
import Card from '@/app/components/ui/Card';
import type { ClientRankingItem } from '../types';
import { formatKrw } from '../lib/format';

type Props = {
  ranking: ClientRankingItem[];
  onRowClick: (code: string, name: string) => void;
};

// 부모 리렌더 (다른 state 변경) 시 ranking/onRowClick 동일하면 skip
export const ClientRankingTable = memo(function ClientRankingTable({ ranking, onRowClick }: Props) {
  if (ranking.length === 0) return null;

  return (
    <Card style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 16 }}>
        거래처별 매출 순위{' '}
        <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
          상위 30
        </span>
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              {['#', '변동', '코드', '거래처명', '매출', '지원률', '수량', '품목수'].map(h => (
                <th key={h} style={{
                  padding: '8px 12px',
                  textAlign: h === '거래처명' ? 'left' : h === '변동' ? 'center' : 'right',
                  fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text-light)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((c, i) => (
              <RankingRow key={c.code} client={c} rank={i + 1} onRowClick={onRowClick} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});

const RankingRow = memo(function RankingRow({
  client: c, rank, onRowClick,
}: { client: ClientRankingItem; rank: number; onRowClick: (code: string, name: string) => void }) {
  const handleClick = useCallback(() => onRowClick(c.code, c.name), [onRowClick, c.code, c.name]);
  return (
    <tr
      onClick={handleClick}
      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,21,56,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: rank <= 3 ? '#8B1538' : 'var(--color-text)' }}>
        {rank}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
        <RankChange isNew={c.isNew} rankChange={c.rankChange} />
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
        {c.code}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8B1538' }}>{c.name}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(c.revenue)}</td>
      <td style={{
        padding: '8px 12px', textAlign: 'right', fontWeight: 600,
        color: c.discountRate != null
          ? c.discountRate > 15 ? '#E53E3E' : c.discountRate > 5 ? '#DD6B20' : '#38A169'
          : 'var(--color-text-lighter)',
      }}>
        {c.discountRate != null ? `${c.discountRate}%` : '-'}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{c.quantity.toLocaleString()}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{c.itemCount}</td>
    </tr>
  );
});

function RankChange({ isNew, rankChange }: { isNew: boolean; rankChange: number | null }) {
  if (isNew) {
    return (
      <span style={{
        background: '#8B1538', color: '#fff',
        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
        fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
      }}>
        NEW
      </span>
    );
  }
  if (rankChange != null && rankChange !== 0) {
    return (
      <span style={{ color: rankChange > 0 ? '#E53E3E' : '#3182CE' }}>
        {rankChange > 0 ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
      </span>
    );
  }
  if (rankChange === 0) {
    return <span style={{ color: 'var(--color-text-lighter)' }}>-</span>;
  }
  return null;
}
