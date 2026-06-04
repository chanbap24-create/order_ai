'use client';

import type { DismissedItem } from '../types';
import { fmt, formatDate } from '../lib/format';

const TYPE_STYLES = {
  red: { bg: 'var(--status-danger-bg)', color: 'var(--status-danger)' },
  white: { bg: '#fff8e1', color: '#f57f17' },
  rose: { bg: '#fce4ec', color: '#ad1457' },
  other: { bg: '#f3e5f5', color: '#6a1b9a' },
};

function typeStyle(type: string) {
  const t = type.toLowerCase();
  if (type === '레드' || t === 'red') return TYPE_STYLES.red;
  if (type === '화이트' || t === 'white') return TYPE_STYLES.white;
  if (type === '로제' || t === 'rosé') return TYPE_STYLES.rose;
  return TYPE_STYLES.other;
}

type Props = {
  item: DismissedItem;
  isChecked: boolean;
  onToggle: () => void;
};

export function DismissedListItem({ item, isChecked, onToggle }: Props) {
  const ts = typeStyle(item.wine_type);

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        border: isChecked ? '1.5px solid var(--action)' : '1px solid var(--border-default)',
        background: isChecked ? '#fdf8f8' : 'white',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        style={{ width: 16, height: 16, accentColor: 'var(--action)', flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.item_name}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
          fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>{item.item_no}</span>
          {item.country && <span>{item.country}</span>}
          {item.wine_type && (
            <span style={{
              padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 600,
              background: ts.bg, color: ts.color,
            }}>
              {item.wine_type}
            </span>
          )}
          {item.supply_price > 0 && <span>{fmt(item.supply_price)}</span>}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: item.current_stock > 0 ? 'var(--status-success)' : 'var(--status-danger)',
        }}>
          {item.current_stock > 0 ? `${item.current_stock}병` : '품절'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {formatDate(item.dismissed_at)} 제외
        </div>
      </div>
    </div>
  );
}
