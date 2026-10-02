'use client';

// 검색 입력 — 채운 회색 필드 + 돋보기 + 지우기(KREAM 검색 문법). 포커스 시에만 블랙 테두리.
import { useState } from 'react';

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 14px',
      borderRadius: 12, background: 'var(--surface-muted)',
      border: `1px solid ${focused ? 'var(--action)' : 'transparent'}`,
      transition: 'border-color 0.15s ease',
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" aria-hidden style={{ flex: 'none', color: 'var(--text-tertiary)' }}>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="와인 이름 · 품번 검색"
        inputMode="search"
        enterKeyHint="search"
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: 'var(--text-primary)' }}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="검색어 지우기"
          style={{
            all: 'unset', cursor: 'pointer', flex: 'none', width: 20, height: 20, borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--text-tertiary)', color: 'var(--surface)', fontSize: 12, lineHeight: 1,
          }}>
          ×
        </button>
      )}
    </div>
  );
}
