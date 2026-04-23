'use client';

import type { RefObject } from 'react';
import type { SuggestionItem } from '../types';

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
    <div ref={p.searchRef} style={{ position: 'relative', marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        거래처
      </label>
      <input
        value={p.clientSearch}
        onChange={e => p.onSearchChange(e.target.value)}
        onFocus={p.onFocus}
        placeholder="거래처명 또는 코드 검색"
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: p.selectedClient ? '1.5px solid rgba(90,21,21,0.25)' : '1.5px solid rgba(90,21,21,0.08)',
          fontSize: 16,
          outline: 'none',
          boxSizing: 'border-box',
          background: p.selectedClient ? 'rgba(90,21,21,0.02)' : '#faf9f7',
        }}
      />
      {p.selectedClient && (
        <span style={{
          position: 'absolute', right: 12, top: 30,
          fontSize: 11, color: '#5A1515', fontWeight: 600, background: 'rgba(90,21,21,0.06)',
          padding: '2px 8px', borderRadius: 6,
        }}>
          {p.selectedClient.code}
        </span>
      )}
      {p.showSuggestions && p.suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid rgba(90,21,21,0.08)',
          maxHeight: 250, overflowY: 'auto',
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
              <span style={{ fontSize: 13, color: '#2c1810' }}>{s.name}</span>
              <span style={{ fontSize: 11, color: '#8a8580' }}>{s.code} · {s.type === 'glass' ? '글라스' : '와인'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
