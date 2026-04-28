import type { CSSProperties } from 'react';

export const labelStyle: CSSProperties = {
  fontSize: 11, color: '#a8a098', fontWeight: 600, marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export const dateInput: CSSProperties = {
  padding: '6px 10px', border: '1px solid rgba(90,21,21,0.12)', borderRadius: 6,
  fontSize: 13, color: '#2c1810', outline: 'none',
};

export const selectStyle: CSSProperties = {
  ...dateInput, width: '100%', minWidth: 140,
};

export const chipBtn: CSSProperties = {
  padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
  border: '1px solid rgba(90,21,21,0.12)', background: '#fff', color: '#5A1515',
  cursor: 'pointer',
};

export const primaryBtn: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
  border: 'none', background: '#5A1515', color: '#fff', cursor: 'pointer',
};

export const tableStyle: CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
};

export const th: CSSProperties = {
  padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#5A1515',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.03em',
  background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.08)',
};

export const td: CSSProperties = {
  padding: '8px 12px', color: '#2c1810',
};

export const trBorder: CSSProperties = {
  borderBottom: '1px solid rgba(0,0,0,0.04)',
};
