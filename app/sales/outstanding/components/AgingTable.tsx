'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AgingRow, Followup } from '../types';
import { fmt, thStyle, tdStyle, tdRight } from '../lib/format';
import { FollowupCell } from './FollowupCell';

type Props = {
  rows: AgingRow[];
  asOf: string;
  onSaveFollowup: (clientCode: string, patch: Partial<Followup>) => void;
};

type SortKey = 'name' | 'net' | 'overdue' | 'cur' | 'm1' | 'm2' | 'm3' | 'days' | 'lastpay';
type SortState = { key: SortKey; dir: 'asc' | 'desc' };

function daysBetween(asOf: string, d: string | null): number | null {
  if (!d) return null;
  return Math.floor((new Date(asOf).getTime() - new Date(d).getTime()) / 86400000);
}

function bucketCell(v: number, danger?: boolean, warn?: boolean): CSSProperties {
  return {
    ...tdRight,
    color: v <= 0 ? 'var(--text-tertiary)' : danger ? '#dc2626' : warn ? '#d97706' : 'var(--text-primary)',
    fontWeight: v > 0 && (danger || warn) ? 700 : 400,
  };
}

function getVal(r: AgingRow, key: SortKey, asOf: string): number | string {
  switch (key) {
    case 'name': return r.client_name || '';
    case 'net': return r.net_balance;
    case 'overdue': return r.overdue;
    case 'cur': return r.b_cur;
    case 'm1': return r.b_m1;
    case 'm2': return r.b_m2;
    case 'm3': return r.b_m3;
    case 'days': return daysBetween(asOf, r.oldest_unpaid_date) ?? -1;
    case 'lastpay': return r.last_payment_date || '';
  }
}

export function AgingTable({ rows, asOf, onSaveFollowup }: Props) {
  const [sort, setSort] = useState<SortState | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getVal(a, sort.key, asOf), vb = getVal(b, sort.key, asOf);
      if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * dir;
      return (va - vb) * dir;
    });
  }, [rows, sort, asOf]);

  const onSort = (key: SortKey) => setSort(prev =>
    prev?.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' });

  const arrow = (key: SortKey) => sort?.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';

  const th = (k: SortKey, label: string, align: 'left' | 'center' | 'right' = 'right') => (
    <th
      onClick={() => onSort(k)}
      style={{ ...thStyle, textAlign: align, cursor: 'pointer', userSelect: 'none', color: sort?.key === k ? 'var(--action)' : thStyle.color }}
    >
      {label}<span style={{ fontSize: 9, opacity: sort?.key === k ? 1 : 0.35 }}>{arrow(k)}</span>
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
        <thead>
          <tr>
            {th('name', '거래처', 'left')}
            {th('net', '미수총액')}
            {th('overdue', '연체')}
            {th('cur', '당월')}
            {th('m1', '1개월')}
            {th('m2', '2개월')}
            {th('m3', '3개월+')}
            {th('days', '경과', 'center')}
            {th('lastpay', '최근수금', 'center')}
            <th style={{ ...thStyle, textAlign: 'left' }}>수금 관리</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const overdue = daysBetween(asOf, r.oldest_unpaid_date);
            return (
              <tr key={r.client_code}>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{r.client_name}</td>
                <td style={{ ...tdRight, fontWeight: 700 }}>{fmt(r.net_balance)}</td>
                <td style={{ ...tdRight, fontWeight: r.overdue > 0 ? 700 : 400, color: r.overdue > 0 ? '#dc2626' : 'var(--text-tertiary)' }}>
                  {r.overdue ? fmt(r.overdue) : '–'}
                </td>
                <td style={bucketCell(r.b_cur)}>{r.b_cur ? fmt(r.b_cur) : '–'}</td>
                <td style={bucketCell(r.b_m1)}>{r.b_m1 ? fmt(r.b_m1) : '–'}</td>
                <td style={bucketCell(r.b_m2, false, true)}>{r.b_m2 ? fmt(r.b_m2) : '–'}</td>
                <td style={bucketCell(r.b_m3, true)}>{r.b_m3 ? fmt(r.b_m3) : '–'}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12, fontWeight: overdue && overdue > 90 ? 700 : 400, color: overdue && overdue > 90 ? '#dc2626' : 'var(--text-tertiary)' }}>
                  {overdue != null ? `${overdue}일` : '–'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {r.last_payment_date ? r.last_payment_date.slice(2) : '–'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'left' }}>
                  <FollowupCell clientCode={r.client_code} followup={r.followup} defaultAmount={r.overdue > 0 ? r.overdue : r.net_balance} onSave={onSaveFollowup} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
