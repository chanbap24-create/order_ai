'use client';

import { memo } from 'react';
import { Section } from '@/app/components/ui';
import type { DashboardStats } from '@/app/types/wine';
import { formatKrw } from '../lib/format';

type Props = {
  items: NonNullable<DashboardStats['inventoryByItemCdv']>;
  label: string;
  color: string;
};

const thBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: 'var(--surface-muted)',
  borderBottom: '1px solid var(--border-default)',
};
const tdBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
};

export const InventoryItemsTable = memo(function InventoryItemsTable({
  items,
  label,
  color,
}: Props) {
  const isSlowMover = (it: (typeof items)[0]) => {
    const qty = it.qty || 0;
    const s90 = it.ship90 || 0;
    return qty > 0 && s90 < qty * 0.25;
  };

  return (
    <Section
      title={`${label} 품목별 재고 Top ${items.length}`}
      meta={
        // 법인 구분은 색 밴드 대신 색 도트로
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: color,
          }}
        />
      }
      padding="none"
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'center', width: 36 }}>#</th>
              <th style={{ ...thBase, textAlign: 'left' }}>품명</th>
              <th style={{ ...thBase, textAlign: 'right' }}>재고</th>
              <th style={{ ...thBase, textAlign: 'right' }}>90일</th>
              <th style={{ ...thBase, textAlign: 'right' }}>재고가액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const slow = isSlowMover(it);
              return (
                <tr
                  key={it.itemNo}
                  style={{
                    color: slow ? 'var(--status-danger)' : undefined,
                    fontWeight: slow ? 600 : undefined,
                  }}
                >
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'center',
                      color: slow ? 'var(--status-danger)' : 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.name}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {it.qty ?? 0}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {it.ship90 ?? 0}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatKrw(it.value)}원
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
});
