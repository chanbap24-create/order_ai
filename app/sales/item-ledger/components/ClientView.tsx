'use client';

import type { ClientSummary } from '../types';
import { fmt, tdStyle, thStyle } from '../lib/format';

export function ClientView({ summary }: { summary: ClientSummary[] }) {
  const grandQty = summary.reduce((s, c) => s + c.total_qty, 0);
  const grandAmt = summary.reduce((s, c) => s + c.total_amount, 0);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
          <th style={thStyle}>납품처명</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>횟수</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>총수량</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>평균단가</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>총금액</th>
          <th style={thStyle}>최초</th>
          <th style={thStyle}>최근</th>
        </tr>
      </thead>
      <tbody>
        {summary.map((c, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.client_name}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{c.ship_count}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.total_qty)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(c.avg_price)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(c.total_amount)}</td>
            <td style={{ ...tdStyle, color: '#8a8580', whiteSpace: 'nowrap' }}>{c.first_date?.slice(2)}</td>
            <td style={{ ...tdStyle, color: '#8a8580', whiteSpace: 'nowrap' }}>{c.last_date?.slice(2)}</td>
          </tr>
        ))}
        <tr style={{ background: '#5A1515', fontWeight: 700 }}>
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
