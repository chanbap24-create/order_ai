'use client';

// 검색 입력 — 첫 화면의 주인공. 흰 바탕 + 진한 테두리 + 은은한 그림자, 포커스 시 그림자 강조.
import { useState } from 'react';

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 16px',
      borderRadius: 14, background: 'var(--surface)', border: '1.5px solid var(--action)',
      boxShadow: focused ? '0 6px 20px rgba(0,0,0,0.10)' : '0 2px 10px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s ease',
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" aria-hidden style={{ flex: 'none', color: 'var(--text-primary)' }}>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="와인 이름 · 품번으로 찾기"
        inputMode="search"
        enterKeyHint="search"
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 17, color: 'var(--text-primary)' }}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="검색어 지우기"
          style={{
            all: 'unset', cursor: 'pointer', flex: 'none', width: 22, height: 22, borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--text-tertiary)', color: 'var(--surface)', fontSize: 13, lineHeight: 1,
          }}>
          ×
        </button>
      )}
    </div>
  );
}
