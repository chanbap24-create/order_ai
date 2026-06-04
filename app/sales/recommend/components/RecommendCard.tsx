'use client';

import type { ScoredItem } from '../types';
import { TAG_COLORS } from '../constants';
import { fmt, scoreColor } from '../lib/format';

type Props = {
  item: ScoredItem;
  isSelected: boolean;
  onToggle: () => void;
};

export function RecommendCard({ item, isSelected, onToggle }: Props) {
  const sc = scoreColor(item.score);
  return (
    <div
      onClick={onToggle}
      style={{
        background: '#fff', borderRadius: 10, padding: '14px',
        border: isSelected ? '2px solid var(--action)' : '1px solid var(--action-muted)',
        boxShadow: isSelected ? '0 0 0 1px rgba(90,21,21,0.1)' : '0 1px 2px rgba(90,21,21,0.03)',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: isSelected ? '2px solid var(--action)' : '2px solid rgba(90,21,21,0.12)',
        background: isSelected ? 'var(--action)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        {isSelected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: sc, minWidth: 32 }}>
            {item.score}점
          </span>
          <span style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.item_name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
          {item.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: `${TAG_COLORS[tag] || '#999'}18`,
              color: TAG_COLORS[tag] || '#999',
              fontWeight: 600,
            }}>
              {tag}
            </span>
          ))}
          {(item.country || item.grape) && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: 4 }}>
              {[item.country, item.region, item.grape].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {item.reason}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {item.price ? fmt(item.price) + '원' : '-'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          재고 {item.stock || 0}
        </div>
        {item.buy_count !== undefined && (
          <div style={{ fontSize: 11, color: '#2196F3', marginTop: 1, fontWeight: 500 }}>
            {item.buy_count}회 구매
          </div>
        )}
      </div>
    </div>
  );
}
