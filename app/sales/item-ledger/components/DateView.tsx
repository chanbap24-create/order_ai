'use client';

import { useMemo, useState } from 'react';
import type { ItemRow } from '../types';
import { fmt, tdStyle, thStyle } from '../lib/format';

type SortKey =
  | 'manager'
  | 'ship_date'
  | 'client_name'
  | 'quantity'
  | 'unit_price'
  | 'supply_amount';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir } | null;

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right'; minWidth?: number }[] = [
  { key: 'manager', label: '판매원', align: 'left' },
  { key: 'ship_date', label: '출고일자', align: 'left' },
  { key: 'client_name', label: '납품처명', align: 'left', minWidth: 160 },
  { key: 'quantity', label: '수량', align: 'right' },
  { key: 'unit_price', label: '단가', align: 'right' },
  { key: 'supply_amount', label: '금액', align: 'right' },
];

export function DateView({ rows }: { rows: ItemRow[] }) {
  const [sort, setSort] = useState<SortState>(null);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const arr = [...rows];
    const { key, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'ko') * factor;
      }
      return (((av as number) || 0) - ((bv as number) || 0)) * factor;
    });
    return arr;
  }, [rows, sort]);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
          {COLUMNS.map((col) => (
            <SortableHeader
              key={col.key}
              label={col.label}
              align={col.align}
              minWidth={col.minWidth}
              active={sort?.key === col.key}
              dir={sort?.key === col.key ? sort.dir : null}
              onClick={() => handleSort(col.key)}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ ...tdStyle, color: '#8a8580' }}>{r.manager || ''}</td>
            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.ship_date?.slice(2)}</td>
            <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.client_name}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', color: r.quantity < 0 ? '#dc2626' : '#2c1810' }}>{fmt(r.quantity)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(r.unit_price)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: r.supply_amount < 0 ? '#dc2626' : '#2c1810' }}>
              {fmt(r.supply_amount)}
            </td>
          </tr>
        ))}
        <tr style={{ background: '#5A1515', fontWeight: 700 }}>
          <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }} colSpan={3}>합계</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>
            {fmt(rows.reduce((s, r) => s + (r.quantity || 0), 0))}
          </td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>
            {fmt(rows.reduce((s, r) => s + (r.supply_amount || 0), 0))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** 정렬 가능한 헤더 셀. 미수현황 OutstandingTable 과 동일 패턴 (3단 토글). */
function SortableHeader({
  label, align, minWidth, active, dir, onClick,
}: {
  label: string;
  align: 'left' | 'right';
  minWidth?: number;
  active: boolean;
  dir: SortDir | null;
  onClick: () => void;
}) {
  return (
    <th
      style={{
        ...thStyle,
        textAlign: align,
        minWidth,
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
