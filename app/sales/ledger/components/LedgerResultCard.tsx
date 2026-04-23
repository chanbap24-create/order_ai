'use client';

import type { ClientInfo, MonthData, Totals } from '../types';
import { fmt } from '../lib/format';
import { tdStyle, thStyle } from '../lib/styles';
import { MonthGroup } from './MonthGroup';

type Props = {
  client: ClientInfo;
  startDate: string;
  endDate: string;
  rowCount: number;
  exporting: boolean;
  onExport: (format: 'excel' | 'pdf') => void;
  onPrint: () => void;
  prevBalance: number;
  grouped: MonthData[];
  collapsedMonths: Set<string>;
  collapsedDays: Set<string>;
  onToggleMonth: (m: string) => void;
  onToggleDay: (d: string) => void;
  grandTotal: Totals;
};

export function LedgerResultCard(p: Props) {
  const finalBalance = p.prevBalance + p.grandTotal.total - p.grandTotal.payment;
  let runBal = p.prevBalance;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '2px solid #5A1515',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#2c1810' }}>{p.client.client_name}</span>
          <span style={{ fontSize: 12, color: '#8a8580', marginLeft: 8 }}>{p.client.client_code}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#8a8580' }}>
            {p.startDate} ~ {p.endDate} · {p.rowCount}건
          </span>
          <button onClick={() => p.onExport('excel')} disabled={p.exporting} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.15)',
            background: '#fff', fontSize: 11, fontWeight: 600, color: '#2e7d32', cursor: 'pointer',
            opacity: p.exporting ? 0.5 : 1,
          }}>
            {p.exporting ? '...' : 'Excel'}
          </button>
          <button onClick={() => p.onExport('pdf')} disabled={p.exporting} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.15)',
            background: '#fff', fontSize: 11, fontWeight: 600, color: '#c62828', cursor: 'pointer',
            opacity: p.exporting ? 0.5 : 1,
          }}>
            PDF
          </button>
          <button onClick={p.onPrint} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.15)',
            background: '#fff', fontSize: 11, fontWeight: 600, color: '#5A1515', cursor: 'pointer',
          }}>
            Print
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
              <th style={thStyle}>일자</th>
              <th style={thStyle}>품목명</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>수량</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>단가</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>공급금액</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>부가세</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>합계</th>
              <th style={{ ...thStyle, textAlign: 'right', color: '#1565C0' }}>수금액</th>
              <th style={{ ...thStyle, textAlign: 'right', color: '#c62828' }}>미수액</th>
            </tr>
          </thead>
          <tbody>
            {p.prevBalance !== 0 && (
              <tr style={{ background: 'rgba(90,21,21,0.02)', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#5A1515' }}>전월미수</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{
                  ...tdStyle, textAlign: 'right', fontWeight: 700,
                  color: p.prevBalance > 0 ? '#c62828' : '#1565C0',
                }}>
                  {fmt(p.prevBalance)}
                </td>
              </tr>
            )}
            {p.grouped.map(month => {
              const monthStartBal = runBal;
              runBal += month.totals.total - month.totals.payment;
              return (
                <MonthGroup
                  key={month.month}
                  month={month}
                  collapsed={p.collapsedMonths.has(month.month)}
                  collapsedDays={p.collapsedDays}
                  onToggleMonth={() => p.onToggleMonth(month.month)}
                  onToggleDay={p.onToggleDay}
                  startBalance={monthStartBal}
                  endBalance={runBal}
                />
              );
            })}
            <tr style={{ background: '#5A1515', fontWeight: 700 }}>
              <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }} colSpan={2}>
                [{p.client.client_name} 합계]
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(p.grandTotal.qty)}</td>
              <td style={{ ...tdStyle, color: '#fff' }}></td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(p.grandTotal.supply)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(p.grandTotal.tax)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(p.grandTotal.total)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#90CAF9' }}>{fmt(p.grandTotal.payment)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#FFCDD2' }}>{fmt(finalBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
