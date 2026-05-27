'use client';

import { useMemo, useState } from 'react';
import type { ClientSummary } from '../types';
import { fmt, tdStyle, thStyle } from '../lib/format';

type SortKey =
  | 'client_name'
  | 'ship_count'
  | 'total_qty'
  | 'avg_price'
  | 'total_amount'
  | 'first_date'
  | 'last_date';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir } | null;

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'client_name', label: '납품처명', align: 'left' },
  { key: 'ship_count', label: '횟수', align: 'right' },
  { key: 'total_qty', label: '총수량', align: 'right' },
  { key: 'avg_price', label: '평균단가', align: 'right' },
  { key: 'total_amount', label: '총금액', align: 'right' },
  { key: 'first_date', label: '최초', align: 'left' },
  { key: 'last_date', label: '최근', align: 'left' },
];

export function ClientView({ summary }: { summary: ClientSummary[] }) {
  const [sort, setSort] = useState<SortState>(null);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const sortedSummary = useMemo(() => {
    if (!sort) return summary;
    const arr = [...summary];
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
  }, [summary, sort]);

  const grandQty = summary.reduce((s, c) => s + c.total_qty, 0);
  const grandAmt = summary.reduce((s, c) => s + c.total_amount, 0);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
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
        {sortedSummary.map((c, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.client_name}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-tertiary)' }}>{c.ship_count}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.total_qty)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-tertiary)' }}>{fmt(c.avg_price)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(c.total_amount)}</td>
            <td style={{ ...tdStyle, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{c.first_date?.slice(2)}</td>
            <td style={{ ...tdStyle, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{c.last_date?.slice(2)}</td>
          </tr>
        ))}
        <tr style={{ background: 'var(--action)', fontWeight: 700 }}>
          <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }}>합계 ({summary.length}개 거래처)</td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandQty)}</td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandAmt)}</td>
          <td style={{ ...tdStyle, color: '#fff' }} colSpan={2}></td>
        </tr>
      </tbody>
    </table>
  );
}

/** 정렬 가능한 헤더 셀. 미수현황 OutstandingTable 과 동일 패턴 (3단 토글). */
function SortableHeader({
  label, align, active, dir, onClick,
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
            color: active ? 'var(--action)' : 'var(--text-tertiary)',
            width: 8,
          }}
        >
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}
