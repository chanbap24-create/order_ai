import type { CSSProperties } from 'react';

/**
 * 페이지·페이지를 넘겨도 일관된 인풋/버튼/라벨 스타일.
 * 모든 페이지의 form 요소는 이 모듈만 import 한다.
 *
 * 규칙:
 *  - height 34
 *  - padding 8/12
 *  - radius 6
 *  - fontSize 13 (input/button) / 11 (label uppercase)
 *  - 색은 의미 토큰만
 */

export const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 4,
};

export const inputStyle: CSSProperties = {
  height: 34,
  width: '100%',
  padding: '0 12px',
  borderRadius: 6,
  border: '1px solid var(--border-default)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  paddingRight: 28,
};

export const dateStyle: CSSProperties = {
  ...inputStyle,
};

export const btnBase: CSSProperties = {
  height: 34,
  padding: '0 16px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
  boxSizing: 'border-box',
};

export const btnPrimary: CSSProperties = {
  ...btnBase,
  background: 'var(--action)',
  color: 'var(--text-on-primary)',
  border: '1px solid var(--action)',
};

export const btnSecondary: CSSProperties = {
  ...btnBase,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
};

export const btnOutline: CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--action)',
  border: '1.5px solid var(--border-strong)',
};

export const btnGhost: CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--text-tertiary)',
  border: '1px solid transparent',
};

export function btnDisabled(base: CSSProperties): CSSProperties {
  return {
    ...base,
    cursor: 'default',
    opacity: 0.5,
  };
}

/** 작은 사이즈 (28px 높이, 패딩 12) — 표 안 액션 버튼 등 */
export const btnSm: CSSProperties = {
  height: 28,
  padding: '0 10px',
  fontSize: 12,
  borderRadius: 6,
};

/** 큰 사이즈 (40px 높이) — 강조 액션 */
export const btnLg: CSSProperties = {
  height: 40,
  padding: '0 20px',
  fontSize: 14,
  borderRadius: 8,
};
