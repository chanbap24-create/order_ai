'use client';

import type { ClientRow, SortKey } from '../types';
import { fmt, fmtDate } from '../lib/format';

type Props = {
  clients: ClientRow[];
  loading: boolean;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  sortIcon: (k: SortKey) => string;
};

const COLS: Array<{ key: SortKey; label: string }> = [
  { key: 'client_name', label: '거래처명' },
  { key: 'business_type', label: '업종' },
  { key: 'last_order_date', label: '최종발주일' },
  { key: 'order_days', label: '발주일수' },
  { key: 'period_qty', label: '수량' },
  { key: 'period_supply', label: '공급가' },
  { key: 'period_total', label: '총액' },
];

export function ClientsTable({ clients, loading, sortKey, onSort, sortIcon }: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
      overflow: 'hidden',
    }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 14 }}>
          불러오는 중...
        </div>
      ) : clients.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8a8580', fontSize: 14 }}>
          해당 기간에 거래 내역이 없습니다.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(90,21,21,0.08)' }}>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => onSort(col.key)}
                    style={{
                      padding: '12px 10px', fontSize: 12, fontWeight: 700,
                      color: sortKey === col.key ? '#5A1515' : '#6b6560',
                      textAlign: col.key === 'client_name' || col.key === 'business_type' ? 'left' : 'right',
                      cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                      background: sortKey === col.key ? 'rgba(90,21,21,0.03)' : 'transparent',
                      transition: 'background 0.2s',
                      position: 'sticky', top: 0,
                    }}
                  >
                    {col.label}{sortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr
                  key={c.client_code || c.client_name + i}
                  style={{ borderBottom: '1px solid rgba(90,21,21,0.04)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(90,21,21,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#2c1810' }}>
                    {c.client_name}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#8a8580' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(90,21,21,0.04)', fontSize: 11, color: '#6b6560',
                    }}>
                      {c.business_type || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#6b6560', textAlign: 'right' }}>
                    {fmtDate(c.last_order_date)}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#6b6560', textAlign: 'right' }}>
                    {c.order_days}일
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#6b6560', textAlign: 'right' }}>
                    {fmt(c.period_qty)}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 13, color: '#2c1810', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(c.period_supply)}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 13, color: '#5A1515', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(c.period_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
