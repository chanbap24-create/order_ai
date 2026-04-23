'use client';

import type { ItemRow } from '../types';
import { fmt, tdStyle, thStyle } from '../lib/format';

export function DateView({ rows }: { rows: ItemRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
          <th style={thStyle}>판매원</th>
          <th style={thStyle}>출고일자</th>
          <th style={{ ...thStyle, minWidth: 160 }}>납품처명</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>수량</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>단가</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>금액</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ ...tdStyle, color: '#8a8580' }}>{r.manager || ''}</td>
            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.ship_date?.slice(2)}</td>
            <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.client_name}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', color: r.quantity < 0 ? '#dc2626' : '#2c1810' }}>{fmt(r.quantity)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(r.unit_price)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: r.supply_amount < 0 ? '#dc2626' : '#2c1810' }}>
              {fmt(r.supply_amount)}
            </td>
          </tr>
        ))}
        <tr style={{ background: '#5A1515', fontWeight: 700 }}>
          <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }} colSpan={3}>합계</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>
            {fmt(rows.reduce((s, r) => s + (r.quantity || 0), 0))}
          </td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>
            {fmt(rows.reduce((s, r) => s + (r.supply_amount || 0), 0))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
