'use client';

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

export function OutstandingTable({ clients, totals, checked, allChecked, onToggleAll, onToggleOne }: Props) {
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
              <th style={{ ...thStyle, textAlign: 'left' }}>거래처명</th>
              <th style={thStyle}>전월미수</th>
              <th style={thStyle}>판매</th>
              <th style={thStyle}>부가세</th>
              <th style={thStyle}>판매계</th>
              <th style={thStyle}>입금</th>
              <th style={thStyle}>현미수</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => {
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
}
