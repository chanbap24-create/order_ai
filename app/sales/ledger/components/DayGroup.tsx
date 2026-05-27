'use client';

import { memo } from 'react';
import type { DayData } from '../types';
import { fmt } from '../lib/format';
import { tdStyle } from '../lib/styles';

type Props = {
  day: DayData;
  collapsed: boolean;
  onToggle: () => void;
  endBalance: number;
};

export const DayGroup = memo(function DayGroup({ day, collapsed, onToggle, endBalance }: Props) {
  const showDaySummary = day.rows.length > 1 || day.paymentRows.length > 0;

  return (
    <>
      {!collapsed && day.rows.map((r, i) => (
        <tr key={`s${i}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <td style={{ ...tdStyle, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {i === 0 ? day.date.slice(5) : ''}
          </td>
          <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.item_name}
          </td>
          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.quantity)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-tertiary)' }}>{fmt(r.selling_price ?? r.unit_price)}</td>
          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.supply_amount)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-tertiary)' }}>{fmt(r.tax_amount)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(r.total_amount)}</td>
          <td style={tdStyle}></td>
          <td style={tdStyle}></td>
        </tr>
      ))}
      {!collapsed && day.paymentRows.map((p, i) => (
        <tr key={`p${i}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'rgba(21,101,192,0.03)' }}>
          <td style={{ ...tdStyle, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {day.rows.length === 0 && i === 0 ? day.date.slice(5) : ''}
          </td>
          <td style={{ ...tdStyle, color: '#1565C0', fontWeight: 600 }}>입금</td>
          <td style={tdStyle}></td>
          <td style={tdStyle}></td>
          <td style={tdStyle}></td>
          <td style={tdStyle}></td>
          <td style={tdStyle}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#1565C0' }}>{fmt(p.amount)}</td>
          <td style={tdStyle}></td>
        </tr>
      ))}
      {showDaySummary && (
        <tr style={{ background: 'rgba(90,21,21,0.02)', cursor: 'pointer' }} onClick={onToggle}>
          <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11 }} colSpan={2}>
            <span style={{ marginRight: 4 }}>{collapsed ? '▶' : '▼'}</span>
            {day.date.slice(5)} 일계
          </td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.qty)}</td>
          <td style={tdStyle}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.supply)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.tax)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{fmt(day.totals.total)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11, color: '#1565C0' }}>{day.totals.payment ? fmt(day.totals.payment) : ''}</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: 11, color: '#c62828' }}>{fmt(endBalance)}</td>
        </tr>
      )}
    </>
  );
});
