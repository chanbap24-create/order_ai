'use client';

import type { WineRowExt } from '../types';

type Props = {
  wine: WineRowExt;
  isMobile: boolean;
  isSelected: boolean;
  deleting: boolean;
  onSelect: () => void;
  onDelete: (id: string, name: string) => void;
};

export function WinesTableRow({ wine: w, isMobile, isSelected, deleting, onSelect, onDelete }: Props) {
  if (isMobile) {
    return (
      <div
        onClick={onSelect}
        style={{
          display: 'grid', gridTemplateColumns: '56px 1fr 56px',
          padding: '10px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
          background: isSelected ? '#eff6ff' : '#fff', gap: 6, alignItems: 'center',
          borderLeft: isSelected ? '3px solid var(--status-info)' : '3px solid transparent',
        }}
      >
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{w.item_code}</span>
        <div style={{ overflow: 'hidden' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {w.item_name_kr}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {w.country_en || w.country || ''}{w.region ? ` · ${w.region}` : ''}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
          {w.available_stock != null ? w.available_stock.toLocaleString() : '-'}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'grid', gridTemplateColumns: '58px 52px 60px 36px 1fr 70px 50px 50px 36px',
        padding: '9px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
        background: isSelected ? '#eff6ff' : '#fff', gap: 6, alignItems: 'center',
        borderLeft: isSelected ? '3px solid var(--status-info)' : '3px solid transparent',
      }}
    >
      <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{w.item_code}</span>
      <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.country_en || w.country || '-'}</span>
      <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.region || '-'}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary-light)' }}>{w.brand || '-'}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {w.item_name_kr}
      </span>
      <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
        {w.supply_price != null ? w.supply_price.toLocaleString() : '-'}
      </span>
      <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
        {w.available_stock != null ? w.available_stock.toLocaleString() : '-'}
      </span>
      <span style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
        {w.bonded_stock != null ? w.bonded_stock.toLocaleString() : '-'}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onDelete(w.item_code, w.item_name_kr); }}
        disabled={deleting}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, padding: 0 }}
        title="삭제"
      >
        🗑️
      </button>
    </div>
  );
}
