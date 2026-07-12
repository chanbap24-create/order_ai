'use client';

import type { ClientInfo, MonthData, Totals } from '../types';
import { fmt } from '../lib/format';
import { tdStyle, thStyle } from '../lib/styles';
import { MonthGroup } from './MonthGroup';
import { btnSecondary } from '@/app/styles/controls';

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

const SMALL_BTN: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  fontWeight: 600,
  cursor: 'pointer',
};

export function LedgerResultCard(p: Props) {
  const finalBalance = p.prevBalance + p.grandTotal.total - p.grandTotal.payment;
  let runBal = p.prevBalance;

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 12,
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.01em',
            }}
          >
            {p.client.client_name}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {p.client.client_code}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {p.startDate} ~ {p.endDate} · {p.rowCount}건
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => p.onExport('excel')}
            disabled={p.exporting}
            style={{ ...SMALL_BTN, opacity: p.exporting ? 0.5 : 1 }}
          >
            Excel
          </button>
          <button
            onClick={() => p.onExport('pdf')}
            disabled={p.exporting}
            style={{ ...SMALL_BTN, opacity: p.exporting ? 0.5 : 1 }}
          >
            PDF
          </button>
          <button onClick={p.onPrint} style={SMALL_BTN}>
            Print
          </button>
        </div>
      </header>

      {/* 표 */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 900,
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>일자</th>
              <th style={thStyle}>품목명</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>수량</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>단가</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>공급금액</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>부가세</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>합계</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>수금액</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>미수액</th>
            </tr>
          </thead>
          <tbody>
            {p.prevBalance !== 0 && (
              <tr style={{ background: 'var(--surface-muted)' }}>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--action)' }}>전월미수</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    color: p.prevBalance > 0 ? 'var(--status-danger)' : 'var(--status-info)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(p.prevBalance)}
                </td>
              </tr>
            )}
            {p.grouped.map((month) => {
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
            <tr style={{ background: 'var(--action)' }}>
              <td
                style={{ ...tdStyle, fontWeight: 700, color: '#fff' }}
                colSpan={2}
              >
                [{p.client.client_name} 합계]
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(p.grandTotal.qty)}
              </td>
              <td style={{ ...tdStyle, color: '#fff' }}></td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(p.grandTotal.supply)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(p.grandTotal.tax)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(p.grandTotal.total)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#90CAF9',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(p.grandTotal.payment)}
              </td>
              <td
                style={{
                  ...tdStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#FFCDD2',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(finalBalance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
