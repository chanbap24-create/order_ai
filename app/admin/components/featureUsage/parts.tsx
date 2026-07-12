'use client';

import type { ReactNode } from 'react';

/** 스탯 스트립 셀 — 박스 없이 세로 구분(divider)만. 부모가 상하 헤어라인을 그린다. */
export function StatCell({ title, value, divider }: { title: string; value: string; divider?: boolean }) {
  return (
    <div style={{
      flex: '1 0 auto', minWidth: 120, padding: '12px 16px',
      borderLeft: divider ? '1px solid var(--border-default)' : 'none',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3,
        letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>{value}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, marginBottom: 16,
      border: '1px solid var(--border-default)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border-default)',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

/** 막대바 셀 (퍼센트 시각화) */
export function PctBar({ pct, color = 'var(--action)' }: { pct: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#f0eeec', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 40, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
