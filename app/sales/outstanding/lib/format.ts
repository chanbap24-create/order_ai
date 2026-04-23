import type { CSSProperties } from 'react';

export function fmt(n: number) { return n.toLocaleString(); }

export function getInitialDates() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstNow.toISOString().slice(0, 10);
  const firstOfMonth = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { today, firstOfMonth };
}

export const thStyle: CSSProperties = {
  padding: '10px 12px', fontSize: 12, fontWeight: 700,
  color: '#5A1515', textAlign: 'right', whiteSpace: 'nowrap',
  borderBottom: '2px solid #5A1515',
};

export const tdStyle: CSSProperties = {
  padding: '10px 12px', fontSize: 13,
  borderBottom: '1px solid rgba(90,21,21,0.06)',
  whiteSpace: 'nowrap',
};

export const tdCenter: CSSProperties = { ...tdStyle, textAlign: 'center', width: 40 };
export const tdRight: CSSProperties = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

export const tfRight: CSSProperties = {
  padding: '12px 12px', fontSize: 13, fontWeight: 700, color: 'white',
  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
};

export const cardStyle: CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid rgba(90,21,21,0.06)',
  boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
  padding: 18, marginBottom: 16,
};
