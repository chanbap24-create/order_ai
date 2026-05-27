'use client';

import type { RefObject } from 'react';
import type { SearchItem } from '../types';
import { inputStyle, labelStyle } from '@/app/styles/controls';

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
    <div ref={p.searchRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>제품코드 / 품목명</label>
      <div style={{ position: 'relative' }}>
        <input
          value={p.itemSearch}
          onChange={(e) => p.onSearchChange(e.target.value)}
          onFocus={p.onFocus}
          placeholder="제품코드 또는 품목명 검색"
          style={{
            ...inputStyle,
            paddingRight: p.selectedItem ? 80 : 12,
            background: p.selectedItem ? 'var(--surface-hover)' : 'var(--surface)',
          }}
        />
        {p.selectedItem && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: 'var(--action)',
              fontWeight: 700,
              background: 'var(--action-muted)',
              padding: '2px 8px',
              borderRadius: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {p.selectedItem.item_no}
          </span>
        )}
      </div>
      {p.showSuggestions && p.suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 50,
            background: 'var(--surface)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            border: '1px solid var(--border-default)',
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {p.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => p.onSelect(s)}
              style={{
                width: '100%',
                padding: '10px 14px',
                cursor: 'pointer',
                border: 'none',
                borderBottom:
                  i < p.suggestions.length - 1
                    ? '1px solid var(--border-subtle)'
                    : 'none',
                background: 'transparent',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  'var(--surface-hover)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
            >
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.item_name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  marginLeft: 8,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.item_no}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
