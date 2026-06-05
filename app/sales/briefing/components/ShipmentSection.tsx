'use client';

import type { ShipmentsData } from '../types';
import { fmtFull } from '../lib/format';

type Props = {
  title: string;
  color: string;
  shipments: ShipmentsData;
  expandedShipClient: string | null;
  setExpandedShipClient: (v: string | null) => void;
  prefix: string;
};

export function ShipmentSection({ title, color, shipments, expandedShipClient, setExpandedShipClient, prefix }: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid var(--action-muted)',
      boxShadow: '0 1px 3px rgba(90,21,21,0.03)', marginBottom: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--action-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{fmtFull(shipments.totals.total)}원</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>거래처</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>업종</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>공급금액</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>부가세</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>합계</th>
            </tr>
          </thead>
          {shipments.clients.map(c => {
            const key = prefix + (c.client_code || c.client_name);
            const isExp = expandedShipClient === key;
            return (
              <tbody key={key}>
                <tr
                  onClick={() => setExpandedShipClient(isExp ? null : key)}
                  style={{ cursor: 'pointer', borderBottom: isExp ? 'none' : '1px solid var(--border-subtle)' }}
                >
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isExp ? '▾ ' : '▸ '}{c.client_name}
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.business_type || '-'}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: '#333', whiteSpace: 'nowrap' }}>{fmtFull(c.supply_amount)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: '#999', whiteSpace: 'nowrap' }}>{fmtFull(c.tax_amount)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fmtFull(c.total_amount)}</td>
                </tr>
                {isExp && (
                  <>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      <td style={{ padding: '4px 10px 4px 28px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>품목</td>
                      <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>품명</td>
                      <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>수량</td>
                      <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>단가</td>
                      <td style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>금액</td>
                    </tr>
                    {c.items.map((it, idx) => (
                      <tr key={idx} style={{ background: 'var(--gray-50)', borderBottom: idx === c.items.length - 1 ? 'none' : '1px solid rgba(90,21,21,0.03)' }}>
                        <td style={{ padding: '4px 10px 4px 28px', fontSize: 11, color: '#666' }}>{it.item_no}</td>
                        <td style={{ padding: '4px 6px', fontSize: 11, color: '#333', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.item_name}</td>
                        <td style={{ padding: '4px 6px', fontSize: 11, color: '#333', textAlign: 'right' }}>{it.quantity}</td>
                        <td style={{ padding: '4px 6px', fontSize: 11, color: '#999', textAlign: 'right' }}>{fmtFull(it.unit_price)}</td>
                        <td style={{ padding: '4px 10px', fontSize: 11, color: '#333', textAlign: 'right', fontWeight: 600 }}>{fmtFull(it.total_amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--action-muted)' }}>
                      <td colSpan={4} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'right' }}>소계</td>
                      <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fmtFull(c.total_amount)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            );
          })}
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(90,21,21,0.1)' }}>
              <td colSpan={2} style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>합계</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#333' }}>{fmtFull(shipments.totals.supply)}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#999' }}>{fmtFull(shipments.totals.tax)}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color }}>{fmtFull(shipments.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
