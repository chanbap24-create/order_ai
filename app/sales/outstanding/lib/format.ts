import type { CSSProperties } from 'react';

export function fmt(n: number) {
  return n.toLocaleString();
}

export function getInitialDates() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstNow.toISOString().slice(0, 10);
  const firstOfMonth = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { today, firstOfMonth };
}

/**
 * 미수현황 전용 표 스타일. 모든 값은 의미 토큰 사용 + 8px grid.
 * 규칙: padding 8/12 만, fontSize 11/12/13 만, color 는 토큰만.
 */

export const thStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: 'var(--surface-muted)',
  borderBottom: '1px solid var(--border-default)',
};

export const tdStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

export const tdCenter: CSSProperties = { ...tdStyle, textAlign: 'center', width: 40 };
export const tdRight: CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

export const tfRight: CSSProperties = {
  padding: '12px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  borderTop: '2px solid var(--border-strong)',
  background: 'var(--surface-muted)',
};
