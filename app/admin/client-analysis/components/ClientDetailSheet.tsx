'use client';

import type { ClientDetailItem } from '../types';
import { formatKrw } from '../lib/format';

type Props = {
  selectedClient: { code: string; name: string } | null;
  items: ClientDetailItem[];
  loading: boolean;
  onClose: () => void;
};

export function ClientDetailSheet({ selectedClient, items, loading, onClose }: Props) {
  if (!selectedClient) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-card, #fff)', borderRadius: '16px 16px 0 0',
          width: '100%', maxWidth: 700, maxHeight: '75vh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{selectedClient.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
              코드: {selectedClient.code}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'var(--color-background)', cursor: 'pointer',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)', fontSize: 'var(--text-sm)' }}>
              로딩 중...
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)' }}>
              데이터가 없습니다.
            </div>
          ) : (
            <DetailTable items={items} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function DetailTable({ items }: { items: ClientDetailItem[] }) {
  const totalRev = items.reduce((s, i) => s + i.revenue, 0);
  const matched = items.filter(i => i.discountRate != null);
  const avgDiscount = matched.length > 0
    ? Math.round(matched.reduce((s, i) => s + (i.discountRate ?? 0) * i.revenue, 0) / matched.reduce((s, i) => s + i.revenue, 0) * 10) / 10
    : null;

  return (
    <>
      <div style={{ display: 'flex', gap: 16, padding: '12px 0 8px', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', fontWeight: 600 }}>
        <span>총 {items.length}개 품목</span>
        <span>매출 {formatKrw(totalRev)}원</span>
        {avgDiscount != null && (
          <span style={{
            color: avgDiscount > 15 ? '#E53E3E' : avgDiscount > 5 ? '#DD6B20' : '#38A169',
          }}>
            평균 지원률 {avgDiscount}%
          </span>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            {['#', '품번', '품명', '공급가', '판매가', '지원률', '수량', '매출'].map(h => (
              <th key={h} style={{
                padding: '8px 10px', fontWeight: 600, fontSize: 'var(--text-xs)',
                color: 'var(--color-text-light)',
                textAlign: h === '품명' ? 'left' : 'right',
                position: 'sticky', top: 0, background: 'var(--color-card, #fff)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.item_no} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-light)', fontSize: 'var(--text-xs)' }}>{idx + 1}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>{item.item_no}</td>
              <td
                style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={item.item_name}
              >
                {item.item_name}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                {item.supplyPrice != null ? item.supplyPrice.toLocaleString() : '-'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
                {item.avgSellingPrice != null ? item.avgSellingPrice.toLocaleString() : '-'}
              </td>
              <td style={{
                padding: '8px 10px', textAlign: 'right', fontWeight: 600,
                color: item.discountRate != null
                  ? item.discountRate > 15 ? '#E53E3E' : item.discountRate > 5 ? '#DD6B20' : '#38A169'
                  : 'var(--color-text-lighter)',
              }}>
                {item.discountRate != null ? `${item.discountRate}%` : '-'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.quantity.toLocaleString()}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
