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
  const ms = new Date(asOf).getTime() - new Date(d).getTime();
  return Math.floor(ms / 86400000);
}

// 연체 강조: 90+ 빨강, 61-90 주황
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
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>거래처</th>
            <th style={thStyle}>미수총액</th>
            <th style={thStyle}>0–30</th>
            <th style={thStyle}>31–60</th>
            <th style={thStyle}>61–90</th>
            <th style={thStyle}>90일+</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>최초미수(경과)</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>최근수금</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>독촉 / 약속 / 메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const overdue = daysBetween(asOf, r.oldest_unpaid_date);
            return (
              <tr key={r.client_code}>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{r.client_name}</td>
                <td style={tdRight}>{fmt(r.net_balance)}</td>
                <td style={bucketCell(r.b_0_30)}>{r.b_0_30 ? fmt(r.b_0_30) : '–'}</td>
                <td style={bucketCell(r.b_31_60)}>{r.b_31_60 ? fmt(r.b_31_60) : '–'}</td>
                <td style={bucketCell(r.b_61_90, false, true)}>{r.b_61_90 ? fmt(r.b_61_90) : '–'}</td>
                <td style={bucketCell(r.b_90plus, true)}>{r.b_90plus ? fmt(r.b_90plus) : '–'}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12, color: overdue && overdue > 90 ? '#dc2626' : 'var(--text-secondary)' }}>
                  {r.oldest_unpaid_date ? `${r.oldest_unpaid_date.slice(2)} (${overdue}일)` : '–'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {r.last_payment_date ? r.last_payment_date.slice(2) : '없음'}
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
