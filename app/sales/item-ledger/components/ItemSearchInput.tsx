'use client';

import type { RefObject } from 'react';
import type { SearchItem } from '../types';

type Props = {
  searchRef: RefObject<HTMLDivElement | null>;
  itemSearch: string;
  onSearchChange: (v: string) => void;
  onFocus: () => void;
  selectedItem: SearchItem | null;
  suggestions: SearchItem[];
  showSuggestions: boolean;
  onSelect: (s: SearchItem) => void;
};

export function ItemSearchInput(p: Props) {
  return (
    <div ref={p.searchRef} style={{ position: 'relative', marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        제품코드 / 품목명
      </label>
      <input
        value={p.itemSearch}
        onChange={e => p.onSearchChange(e.target.value)}
        onFocus={p.onFocus}
        placeholder="제품코드 또는 품목명 검색"
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: p.selectedItem ? '1.5px solid rgba(90,21,21,0.25)' : '1.5px solid rgba(90,21,21,0.08)',
          fontSize: 16, outline: 'none', boxSizing: 'border-box',
          background: p.selectedItem ? 'rgba(90,21,21,0.02)' : '#faf9f7',
        }}
      />
      {p.selectedItem && (
        <span style={{
          position: 'absolute', right: 12, top: 30,
          fontSize: 11, color: '#5A1515', fontWeight: 600, background: 'rgba(90,21,21,0.06)',
          padding: '2px 8px', borderRadius: 6,
        }}>
          {p.selectedItem.item_no}
        </span>
      )}
      {p.showSuggestions && p.suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid rgba(90,21,21,0.08)',
          maxHeight: 300, overflowY: 'auto',
        }}>
          {p.suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => p.onSelect(s)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: i < p.suggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(90,21,21,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 13, color: '#2c1810', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.item_name}
              </span>
              <span style={{ fontSize: 11, color: '#8a8580', marginLeft: 8, flexShrink: 0 }}>
                {s.item_no}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
