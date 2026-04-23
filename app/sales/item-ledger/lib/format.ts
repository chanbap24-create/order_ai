import type { CSSProperties } from 'react';

export function fmt(n: number) {
  return n.toLocaleString();
}

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export const thStyle: CSSProperties = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#5A1515',
  textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em',
};

export const tdStyle: CSSProperties = {
  padding: '8px 12px', fontSize: 12, color: '#2c1810', whiteSpace: 'nowrap',
};
