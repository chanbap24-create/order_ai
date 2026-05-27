import type { CSSProperties } from 'react';

/**
 * 페이지·페이지를 넘겨도 일관된 표 스타일.
 * 모든 페이지의 표는 이 모듈만 import 한다.
 *
 * 규칙:
 *  - thead: uppercase 11 / fontWeight 700 / muted bg / strong border-bottom
 *  - tbody td: 10/12 padding / 13 fontSize / subtle border-bottom
 *  - tfoot: 12 padding / 13 fontSize / strong border-top / muted bg
 *  - tabular-nums on right-aligned cells
 *  - row hover: var(--surface-hover)
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

export const thLeft: CSSProperties = {
  ...thStyle,
  textAlign: 'left',
};

export const thCenter: CSSProperties = {
  ...thStyle,
  textAlign: 'center',
};

export const tdStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

export const tdRight: CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

export const tdCenter: CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
};

export const tdMuted: CSSProperties = {
  ...tdStyle,
  color: 'var(--text-tertiary)',
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

export const tfLeft: CSSProperties = {
  ...tfRight,
  textAlign: 'left',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};
