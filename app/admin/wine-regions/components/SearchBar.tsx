'use client';

import type { ViewMode } from '../types';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
};

export function SearchBar({ search, onSearchChange, viewMode, onViewModeChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="국가, 지역, AOC, 품종, 등급 검색..."
          style={{
            width: '100%', height: 38, padding: '0 12px 0 36px', fontSize: 14,
            border: '1px solid #E5E5E5', borderRadius: 8, boxSizing: 'border-box',
            outline: 'none', background: '#fff',
          }}
        />
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#bbb" strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', left: 10, top: 11, pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {search && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute', right: 8, top: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#a8a098', fontSize: 16, lineHeight: 1,
            }}
          >
            x
          </button>
        )}
      </div>
      <div style={{ display: 'flex', background: 'rgba(90,21,21,0.05)', borderRadius: 6, padding: 2 }}>
        {(['tree', 'table'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            style={{
              padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none',
              borderRadius: 4, cursor: 'pointer',
              background: viewMode === mode ? '#fff' : 'transparent',
              color: viewMode === mode ? '#5A1515' : '#a8a098',
              boxShadow: viewMode === mode ? '0 1px 3px rgba(90,21,21,0.08)' : 'none',
            }}
          >
            {mode === 'tree' ? '트리' : '테이블'}
          </button>
        ))}
      </div>
    </div>
  );
}
