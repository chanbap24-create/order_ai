'use client';

import type { RefObject } from 'react';
import type { SuggestionItem } from '../types';
import { inputStyle, labelStyle } from '@/app/styles/controls';

type Props = {
  searchRef: RefObject<HTMLDivElement | null>;
  clientSearch: string;
  onSearchChange: (v: string) => void;
  onFocus: () => void;
  selectedClient: SuggestionItem | null;
  suggestions: SuggestionItem[];
  showSuggestions: boolean;
  onSelect: (s: SuggestionItem) => void;
};

export function ClientSearchInput(p: Props) {
  return (
    <div ref={p.searchRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>거래처</label>
      <input
        value={p.clientSearch}
        onChange={(e) => p.onSearchChange(e.target.value)}
        onFocus={p.onFocus}
        placeholder="거래처명 또는 코드 검색"
        style={{
          ...inputStyle,
          paddingRight: p.selectedClient ? 80 : 12,
          background: p.selectedClient ? 'var(--surface-hover)' : 'var(--surface)',
        }}
      />
      {p.selectedClient && (
        <span
          style={{
            position: 'absolute',
            right: 8,
            top: 'calc(50% + 7px)',
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
          {p.selectedClient.code}
        </span>
      )}
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
            maxHeight: 260,
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
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  'var(--surface-hover)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
            >
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.code} · {s.type === 'glass' ? '글라스' : '와인'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
