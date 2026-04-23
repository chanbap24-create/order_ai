'use client';

import type { ClientDetail } from '../types';

export function AlertClientsList({ clients }: { clients: ClientDetail[] }) {
  return (
    <div style={{ borderTop: '1px solid #f0f0f0', background: '#fafaf8' }}>
      <div style={{
        display: 'flex', padding: '8px 14px',
        fontSize: 11, color: '#a8a098', fontWeight: 600, borderBottom: '1px solid #f0f0f0',
      }}>
        <span style={{ flex: 1 }}>거래처명</span>
        <span style={{ width: 60, textAlign: 'right' }}>수량</span>
        <span style={{ width: 90, textAlign: 'right' }}>최근 출고</span>
      </div>
      {clients.map(c => (
        <div key={c.client_code} style={{
          display: 'flex', alignItems: 'center', padding: '7px 14px',
          fontSize: 12, borderBottom: '1px solid rgba(90,21,21,0.06)',
        }}>
          <span style={{ flex: 1, fontWeight: 500, color: '#2c1810' }}>{c.client_name}</span>
          <span style={{ width: 60, textAlign: 'right', fontWeight: 600, color: '#5A1515' }}>
            {c.total_qty}병
          </span>
          <span style={{ width: 90, textAlign: 'right', color: '#a8a098', fontSize: 11 }}>
            {c.last_date || '-'}
          </span>
        </div>
      ))}
      {clients.length === 0 && (
        <div style={{ padding: '12px 14px', fontSize: 12, color: '#a8a098' }}>
          출고 기록이 없습니다.
        </div>
      )}
    </div>
  );
}
