'use client';

import type { TopItem } from '../types';
import { TYPE_COLORS, fmt, fmtM } from '../lib/format';

type Props = {
  items: TopItem[];
  showAll: boolean;
  onToggleShowAll: () => void;
};

export function TopItemsTable({ items, showAll, onToggleShowAll }: Props) {
  const displayed = showAll ? items : items.slice(0, 50);

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#f8f6f4', borderBottom: '2px solid rgba(90,21,21,0.1)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#5A1515' }}>품목</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>국가</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>지역</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#666' }}>타입</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#666' }}>평균단가</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#666' }}>금액</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>수량</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '6px 12px', color: '#2c1810', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#bbb', fontSize: 10, marginRight: 4 }}>{item.item_no}</span>
                  {item.item_name}
                </td>
                <td style={{ padding: '6px 8px', color: '#666', fontSize: 11 }}>{item.country || '-'}</td>
                <td style={{ padding: '6px 8px', color: '#888', fontSize: 10 }}>{item.region || '-'}</td>
                <td style={{ padding: '6px 8px', fontSize: 11, color: TYPE_COLORS[item.wine_type || ''] || '#666', fontWeight: 600 }}>
                  {item.wine_type || '-'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: '#888' }}>
                  {item.avg_price > 0 ? fmt(item.avg_price) : '-'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: '#666' }}>
                  {item.amount > 0 ? fmtM(item.amount) : '-'}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#2c1810' }}>
                  {fmt(item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 50 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <button
            onClick={onToggleShowAll}
            style={{
              fontSize: 12, fontWeight: 500, color: '#5A1515',
              background: 'transparent', border: '1px solid rgba(90,21,21,0.15)',
              borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
            }}
          >
            {showAll ? '50개만' : `전체 ${items.length}개`}
          </button>
        </div>
      )}
    </div>
  );
}
