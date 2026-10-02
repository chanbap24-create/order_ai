'use client';

// 검색 입력 — 첫 화면의 주인공. 테두리 없이 그림자로 띄움(구글식), 포커스 시 그림자 강조.
// 오른쪽 끝 = 와인/글라스 전환 스위치(전원 스위치처럼 좌우, 색으로 구분). 안내 문구도 종류에 맞게.
import { useState } from 'react';
import { GOLD } from '../brand';

// 와인=샴페인 골드(기본, 손잡이 왼쪽) · 글라스=실버 그레이(손잡이 오른쪽, 골드와 같은 밝기). 글자 없이 색으로만 — 안내 문구가 종류를 말해 준다
function KindSwitch({ kind, onToggle }: { kind: 'wine' | 'glass'; onToggle: () => void }) {
  const glass = kind === 'glass';
  return (
    <button type="button" role="switch" aria-checked={glass} aria-label={glass ? '글라스 재고 — 와인으로 전환' : '와인 재고 — 글라스로 전환'}
      onClick={onToggle}
      style={{
        all: 'unset', cursor: 'pointer', flex: 'none', position: 'relative', width: 48, height: 28, borderRadius: 999,
        background: glass ? 'var(--neutral-100)' : GOLD, transition: 'background 0.25s ease', boxSizing: 'border-box',
      }}>
      <i aria-hidden style={{
        position: 'absolute', top: 3, left: glass ? 23 : 3, width: 22, height: 22, borderRadius: '50%',
        background: 'var(--surface)', boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
        transition: 'left 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }} />
    </button>
  );
}

export function SearchBar({ value, onChange, kind, onToggleKind }: {
  value: string; onChange: (v: string) => void;
  kind: 'wine' | 'glass'; onToggleKind: () => void;
}) {
  const placeholder = kind === 'glass' ? '어떤 글라스를 찾으세요?' : '어떤 와인을 찾으세요?';
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 14px 0 22px',
      borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-subtle)', // 알약 — 안쪽 스위치와 같은 곡률
      boxShadow: focused
        ? '0 2px 8px rgba(0,0,0,0.14), 0 12px 32px rgba(0,0,0,0.16)'
        : '0 2px 6px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.12)',
      transition: 'box-shadow 0.2s ease',
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" aria-hidden style={{ flex: 'none', color: 'var(--text-primary)' }}>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      {/* 안내 문구 — 종류 단어만 색으로(와인=샴페인 골드). 입력칸 placeholder는 한 색뿐이라 같은 자리에 겹쳐 그린다 */}
      <span style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
        {!value && (
          <span aria-hidden style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none',
            fontSize: 17, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            {kind === 'glass'
              ? <>어떤 글라스를 찾으세요?</>
              : <>어떤&nbsp;<span style={{ color: GOLD }}>와인</span>을&nbsp;찾으세요?</>}
          </span>
        )}
        <input
          className="store-search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={placeholder}
          inputMode="search"
          enterKeyHint="search"
          style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 17, color: 'var(--text-primary)' }}
        />
      </span>
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
      <KindSwitch kind={kind} onToggle={onToggleKind} />
    </div>
  );
}
