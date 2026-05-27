import type { CSSProperties } from 'react';

/**
 * 매출처원장 전용 표 스타일.
 * 페이지 공용 table.ts 와 톤 동일 (uppercase 11/tertiary thead, 13 tbody).
 */

export const thStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: 'var(--surface-muted)',
};

export const tdStyle: CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};
