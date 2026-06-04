'use client';

import { memo, useCallback } from 'react';
import { Section } from '@/app/components/ui';
import type { ClientRankingItem } from '../types';
import { formatKrw } from '../lib/format';

type Props = {
  ranking: ClientRankingItem[];
  onRowClick: (code: string, name: string) => void;
};

const COLS: { key: string; label: string; align: 'left' | 'right' | 'center' }[] = [
  { key: 'rank', label: '#', align: 'right' },
  { key: 'change', label: '변동', align: 'center' },
  { key: 'code', label: '코드', align: 'right' },
  { key: 'name', label: '거래처명', align: 'left' },
  { key: 'revenue', label: '매출', align: 'right' },
  { key: 'discount', label: '지원률', align: 'right' },
  { key: 'qty', label: '수량', align: 'right' },
  { key: 'items', label: '품목수', align: 'right' },
];

const thBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: 'var(--surface-muted)',
  borderBottom: '1px solid var(--border-default)',
};
const tdBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

export const ClientRankingTable = memo(function ClientRankingTable({
  ranking,
  onRowClick,
}: Props) {
  if (ranking.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <Section title="거래처별 매출 순위" meta={`상위 ${ranking.length}`} padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={{ ...thBase, textAlign: c.align }}>
                    {c.label}
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
      </Section>
    </div>
  );
});

const RankingRow = memo(function RankingRow({
  client: c,
  rank,
  onRowClick,
}: {
  client: ClientRankingItem;
  rank: number;
  onRowClick: (code: string, name: string) => void;
}) {
  const handleClick = useCallback(() => onRowClick(c.code, c.name), [onRowClick, c.code, c.name]);
  return (
    <tr
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      <td
        style={{
          ...tdBase,
          textAlign: 'right',
          fontWeight: 700,
          color: rank <= 3 ? 'var(--action)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rank}
      </td>
      <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
        <RankChange isNew={c.isNew} rankChange={c.rankChange} />
      </td>
      <td
        style={{
          ...tdBase,
          textAlign: 'right',
          fontSize: 12,
          color: 'var(--text-tertiary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {c.code}
      </td>
      <td style={{ ...tdBase, fontWeight: 600, color: 'var(--action)' }}>{c.name}</td>
      <td
        style={{
          ...tdBase,
          textAlign: 'right',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatKrw(c.revenue)}
      </td>
      <td
        style={{
          ...tdBase,
          textAlign: 'right',
          fontWeight: 600,
          color:
            c.discountRate != null
              ? c.discountRate > 15
                ? 'var(--status-danger)'
                : c.discountRate > 5
                  ? 'var(--status-warning)'
                  : 'var(--status-success)'
              : 'var(--text-muted)',
        }}
      >
        {c.discountRate != null ? `${c.discountRate}%` : '-'}
      </td>
      <td style={{ ...tdBase, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {c.quantity.toLocaleString()}
      </td>
      <td style={{ ...tdBase, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {c.itemCount}
      </td>
    </tr>
  );
});

function RankChange({ isNew, rankChange }: { isNew: boolean; rankChange: number | null }) {
  if (isNew) {
    return (
      <span
        style={{
          display: 'inline-block',
          background: 'var(--action)',
          color: 'var(--text-on-primary)',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.5,
        }}
      >
        NEW
      </span>
    );
  }
  if (rankChange != null && rankChange !== 0) {
    return (
      <span style={{ color: rankChange > 0 ? 'var(--status-danger)' : 'var(--status-info)' }}>
        {rankChange > 0 ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
      </span>
    );
  }
  if (rankChange === 0) {
    return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  }
  return null;
}
