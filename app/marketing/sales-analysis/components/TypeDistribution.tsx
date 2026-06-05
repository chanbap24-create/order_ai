'use client';

import { memo } from 'react';
import type { AnalysisData } from '../types';
import { TYPE_COLORS, fmt, fmtM, pct } from '../lib/format';

export const TypeDistribution = memo(function TypeDistribution({ data }: { data: AnalysisData }) {
  if (data.types.length === 0) return null;

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid var(--action-muted)',
      padding: '12px 16px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
        {data.types.map(t => (
          <div
            key={t.name}
            title={`${t.name} ${fmtM(t.amount)} (${pct(t.amount, data.total_amount)}%)`}
            style={{
              width: `${pct(t.amount, data.total_amount)}%`,
              background: TYPE_COLORS[t.name] || 'var(--neutral-100)',
              minWidth: t.amount > 0 ? 2 : 0,
              transition: 'width 0.3s',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {data.types.map(t => (
          <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLORS[t.name] || 'var(--neutral-100)' }} />
            <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>{t.name}</span>
            <span style={{ color: 'var(--neutral-100)' }}>{fmtM(t.amount)} ({pct(t.amount, data.total_amount)}%)</span>
            <span style={{ color: '#bbb' }}>{fmt(t.qty)}병</span>
          </div>
        ))}
      </div>
    </div>
  );
});
