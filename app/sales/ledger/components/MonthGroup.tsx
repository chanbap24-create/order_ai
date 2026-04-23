'use client';

import type { MonthData } from '../types';
import { fmt } from '../lib/format';
import { tdStyle } from '../lib/styles';
import { DayGroup } from './DayGroup';

type Props = {
  month: MonthData;
  collapsed: boolean;
  collapsedDays: Set<string>;
  onToggleMonth: () => void;
  onToggleDay: (d: string) => void;
  startBalance: number;
  endBalance: number;
};

export function MonthGroup({ month, collapsed, collapsedDays, onToggleMonth, onToggleDay, startBalance, endBalance }: Props) {
  return (
    <>
      {!collapsed && (() => {
        let dayBal = startBalance;
        return month.days.map(day => {
          dayBal += day.totals.total - day.totals.payment;
          return (
            <DayGroup
              key={day.date}
              day={day}
              collapsed={collapsedDays.has(day.date)}
              onToggle={() => onToggleDay(day.date)}
              endBalance={dayBal}
            />
          );
        });
      })()}
      <tr style={{ background: '#FFF8E1', cursor: 'pointer' }} onClick={onToggleMonth}>
        <td style={{ ...tdStyle, fontWeight: 700, color: '#5A1515' }} colSpan={2}>
          <span style={{ marginRight: 6 }}>{collapsed ? '▶' : '▼'}</span>
          {month.month} 월계
        </td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.qty)}</td>
        <td style={tdStyle}></td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.supply)}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.tax)}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{fmt(month.totals.total)}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#1565C0' }}>{month.totals.payment ? fmt(month.totals.payment) : ''}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#c62828' }}>{fmt(endBalance)}</td>
      </tr>
    </>
  );
}
