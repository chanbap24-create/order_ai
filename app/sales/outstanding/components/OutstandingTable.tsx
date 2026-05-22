'use client';

import { memo, useMemo, useState } from 'react';
import type { OutstandingClient, OutstandingTotals } from '../types';
import { cardStyle, fmt, tdCenter, tdRight, tdStyle, tfRight, thStyle } from '../lib/format';

type Props = {
  clients: OutstandingClient[];
  totals: OutstandingTotals;
  checked: Set<string>;
  allChecked: boolean;
  onToggleAll: () => void;
  onToggleOne: (code: string) => void;
};

type SortKey =
  | 'client_name'
  | 'prev_balance'
  | 'period_supply'
  | 'period_tax'
  | 'period_total'
  | 'period_payment'
  | 'outstanding';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir } | null;

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'client_name', label: '거래처명', align: 'left' },
  { key: 'prev_balance', label: '전월미수', align: 'right' },
  { key: 'period_supply', label: '판매', align: 'right' },
  { key: 'period_tax', label: '부가세', align: 'right' },
  { key: 'period_total', label: '판매계', align: 'right' },
  { key: 'period_payment', label: '입금', align: 'right' },
  { key: 'outstanding', label: '현미수', align: 'right' },
];

export const OutstandingTable = memo(function OutstandingTable({ clients, totals, checked, allChecked, onToggleAll, onToggleOne }: Props) {
  const [sort, setSort] = useState<SortState>(null);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null; // 같은 키 두 번째 토글 → 원본 순서 복귀
    });
  };

  const sortedClients = useMemo(() => {
    if (!sort) return clients;
    const arr = [...clients];
    const { key, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'ko') * factor;
      }
      return (((av as number) || 0) - ((bv as number) || 0)) * factor;
    });
    return arr;
  }, [clients, sort]);

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
          <thead>
            <tr style={{ background: '#F5F0F0' }}>
              <th style={thStyle}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }}
                />
              </th>
              {COLUMNS.map((col) => (
                <SortableHeader
                  key={col.key}
                  label={col.label}
                  align={col.align}
                  active={sort?.key === col.key}
                  dir={sort?.key === col.key ? sort.dir : null}
                  onClick={() => handleSort(col.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedClients.map((c, i) => {
              const isChecked = checked.has(c.client_code);
              return (
                <tr
                  key={c.client_code}
                  style={{
                    background: isChecked ? 'rgba(90,21,21,0.03)' : i % 2 === 0 ? '#fff' : '#faf9f7',
                    cursor: 'pointer',
                  }}
                  onClick={() => onToggleOne(c.client_code)}
                >
                  <td style={tdCenter}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleOne(c.client_code)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#2c1810' }}>{c.client_name}</td>
                  <td style={tdRight}>{fmt(c.prev_balance)}</td>
                  <td style={tdRight}>{fmt(c.period_supply)}</td>
                  <td style={tdRight}>{fmt(c.period_tax)}</td>
                  <td style={{ ...tdRight, fontWeight: 600 }}>{fmt(c.period_total)}</td>
                  <td style={{ ...tdRight, color: '#1565C0' }}>{fmt(c.period_payment)}</td>
                  <td style={{
                    ...tdRight, fontWeight: 700,
                    color: c.outstanding > 0 ? '#C62828' : c.outstanding < 0 ? '#1565C0' : '#2c1810',
                  }}>
                    {fmt(c.outstanding)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#5A1515' }}>
              <td style={{ ...tdCenter, color: 'white' }} colSpan={2}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>합계 ({clients.length}개)</span>
              </td>
              <td style={tfRight}>{fmt(totals.prev_balance)}</td>
              <td style={tfRight}>{fmt(totals.period_supply)}</td>
              <td style={tfRight}>{fmt(totals.period_tax)}</td>
              <td style={tfRight}>{fmt(totals.period_total)}</td>
              <td style={tfRight}>{fmt(totals.period_payment)}</td>
              <td style={tfRight}>{fmt(totals.outstanding)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

/** 정렬 가능한 헤더 셀. 클릭 시 onClick 발화. 활성 컬럼엔 ▲/▼ 표시. */
function SortableHeader({
  label,
  align,
  active,
  dir,
  onClick,
}: {
  label: string;
  align: 'left' | 'right';
  active: boolean;
  dir: SortDir | null;
  onClick: () => void;
}) {
  return (
    <th
      style={{
        ...thStyle,
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onClick={onClick}
      title="클릭하여 정렬"
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span
          style={{
            fontSize: 10,
            opacity: active ? 1 : 0.3,
            color: active ? '#5A1515' : '#8a8580',
            width: 8,
          }}
        >
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}
