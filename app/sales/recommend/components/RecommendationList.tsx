'use client';

import type { ScoredItem } from '../types';
import { RecommendCard } from './RecommendCard';

type Props = {
  items: ScoredItem[];
  selected: Set<string>;
  onToggle: (itemNo: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
};

export function RecommendationList({ items, selected, onToggle, allSelected, onToggleAll }: Props) {
  return (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, padding: '0 4px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          AI 추천 {items.length}개
        </div>
        {items.length > 0 && (
          <button
            onClick={onToggleAll}
            style={{
              fontSize: 12, color: 'var(--action)', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline',
            }}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13,
          background: '#fff', borderRadius: 12, border: '1px solid var(--action-muted)',
        }}>
          추천할 와인이 없습니다
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border-default)' }}>
          {items.map(item => (
            <RecommendCard
              key={item.item_no}
              item={item}
              isSelected={selected.has(item.item_no)}
              onToggle={() => onToggle(item.item_no)}
            />
          ))}
        </div>
      )}
    </>
  );
}
