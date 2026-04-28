'use client';

import type { ReactNode } from 'react';

export function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 18px',
      border: '1px solid rgba(90,21,21,0.06)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      <div style={{ fontSize: 11, color: '#a8a098', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#5A1515', marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, marginBottom: 16,
      border: '1px solid rgba(90,21,21,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#2c1810',
        borderBottom: '1px solid rgba(90,21,21,0.08)',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

/** 막대바 셀 (퍼센트 시각화) */
export function PctBar({ pct, color = '#5A1515' }: { pct: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#f0eeec', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 11, color: '#8a8580', width: 40, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
