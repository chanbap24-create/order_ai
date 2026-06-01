'use client';

import type { CSSProperties } from 'react';
import type { AgingRow, Followup } from '../types';
import { fmt, thStyle, tdStyle, tdRight } from '../lib/format';
import { FollowupCell } from './FollowupCell';

type Props = {
  rows: AgingRow[];
  asOf: string;
  onSaveFollowup: (clientCode: string, patch: Partial<Followup>) => void;
};

function daysBetween(asOf: string, d: string | null): number | null {
  if (!d) return null;
  return Math.floor((new Date(asOf).getTime() - new Date(d).getTime()) / 86400000);
}

// 연체 강조: 3개월+ 빨강, 2개월 주황
function bucketCell(v: number, danger?: boolean, warn?: boolean): CSSProperties {
  return {
    ...tdRight,
    color: v <= 0 ? 'var(--text-tertiary)' : danger ? '#dc2626' : warn ? '#d97706' : 'var(--text-primary)',
    fontWeight: v > 0 && (danger || warn) ? 700 : 400,
  };
}

export function AgingTable({ rows, asOf, onSaveFollowup }: Props) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>거래처</th>
            <th style={thStyle}>미수총액</th>
            <th style={thStyle}>연체(예정일↑)</th>
            <th style={thStyle}>당월</th>
            <th style={thStyle}>1개월</th>
            <th style={thStyle}>2개월</th>
            <th style={thStyle}>3개월+</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>경과</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>최근수금</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>수금 관리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
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
                  <FollowupCell clientCode={r.client_code} followup={r.followup} onSave={onSaveFollowup} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
