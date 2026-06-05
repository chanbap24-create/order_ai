'use client';

import { memo, useMemo } from 'react';
import type { TopItem } from '../types';
import { TYPE_COLORS, fmt, fmtM } from '../lib/format';

type Props = {
  items: TopItem[];
  showAll: boolean;
  onToggleShowAll: () => void;
};

export const TopItemsTable = memo(function TopItemsTable({ items, showAll, onToggleShowAll }: Props) {
  const displayed = useMemo(() => (showAll ? items : items.slice(0, 50)), [showAll, items]);

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid var(--action-muted)',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid rgba(90,21,21,0.1)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--action)' }}>품목</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--neutral-400)' }}>국가</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--neutral-400)' }}>지역</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--neutral-400)' }}>타입</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--neutral-400)' }}>평균단가</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--neutral-400)' }}>금액</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--action)' }}>수량</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)', background: i % 2 === 0 ? '#fff' : 'var(--gray-50)' }}>
                <td style={{ padding: '6px 12px', color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#bbb', fontSize: 10, marginRight: 4 }}>{item.item_no}</span>
                  {item.item_name}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--neutral-400)', fontSize: 11 }}>{item.country || '-'}</td>
                <td style={{ padding: '6px 8px', color: 'var(--neutral-200)', fontSize: 10 }}>{item.region || '-'}</td>
                <td style={{ padding: '6px 8px', fontSize: 11, color: TYPE_COLORS[item.wine_type || ''] || 'var(--neutral-400)', fontWeight: 600 }}>
                  {item.wine_type || '-'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: 'var(--neutral-200)' }}>
                  {item.avg_price > 0 ? fmt(item.avg_price) : '-'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: 'var(--neutral-400)' }}>
                  {item.amount > 0 ? fmtM(item.amount) : '-'}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {fmt(item.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 50 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gray-100)', textAlign: 'center' }}>
          <button
            onClick={onToggleShowAll}
            style={{
              fontSize: 12, fontWeight: 500, color: 'var(--action)',
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
});
