'use client';

import { memo } from 'react';
import Card from '@/app/components/ui/Card';
import type { DashboardStats } from '@/app/types/wine';
import { formatKrw } from '../lib/format';

type Props = {
  items: NonNullable<DashboardStats['inventoryByItemCdv']>;
  label: string;
  color: string;
};

export const InventoryItemsTable = memo(function InventoryItemsTable({ items, label, color }: Props) {
  const isSlowMover = (it: typeof items[0]) => {
    const qty = it.qty || 0;
    const s90 = it.ship90 || 0;
    return qty > 0 && s90 < qty * 0.25;
  };

  return (
    <Card>
      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
        <span style={{ color }}>{label}</span> 품목별 재고 Top {items.length}
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg-light, #faf9f7)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, width: 30 }}>#</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>품명</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>재고</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>90일</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>재고가액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const slow = isSlowMover(it);
              const rowColor = slow ? '#E53E3E' : undefined;
              return (
                <tr key={it.itemNo} style={{ borderBottom: '1px solid var(--color-border)', color: rowColor, fontWeight: slow ? 600 : undefined }}>
                  <td style={{ padding: '5px 8px', textAlign: 'center', color: slow ? '#E53E3E' : 'var(--color-text-lighter)' }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '5px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.name}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{it.qty ?? 0}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{it.ship90 ?? 0}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(it.value)}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
});
