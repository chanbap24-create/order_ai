'use client';

import { memo } from 'react';
import type { AnalysisData } from '../types';
import { fmt, pct } from '../lib/format';

export const MonthlyTrend = memo(function MonthlyTrend({ data }: { data: AnalysisData }) {
  const maxMonthQty = Math.max(...data.monthly.map(m => m.qty), 1);

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid rgba(90,21,21,0.06)', padding: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.monthly.map((m, i) => {
          const prevQty = i > 0 ? data.monthly[i - 1].qty : 0;
          const change = prevQty > 0 ? Math.round((m.qty - prevQty) / prevQty * 100) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
              <div style={{ width: 55, fontSize: 11, color: '#999', flexShrink: 0 }}>{m.month}</div>
              <div style={{ flex: 1, height: 20, background: '#f5f0f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct(m.qty, maxMonthQty)}%`, height: '100%',
                  background: m.qty >= data.monthly_avg ? 'var(--action)' : '#C4A0A0',
                  borderRadius: 3,
                  minWidth: m.qty > 0 ? 2 : 0,
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ width: 55, textAlign: 'right', fontSize: 11, color: '#666', fontWeight: 500, flexShrink: 0 }}>
                {fmt(m.qty)}
              </div>
              {i > 0 && change !== 0 ? (
                <div style={{
                  width: 40, textAlign: 'right', fontSize: 10, fontWeight: 600,
                  color: change > 0 ? 'var(--status-success)' : 'var(--status-danger)', flexShrink: 0,
                }}>
                  {change > 0 ? '+' : ''}{change}%
                </div>
              ) : (
                <div style={{ width: 40, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#999', display: 'flex', gap: 16 }}>
        <span>월 평균 {fmt(data.monthly_avg)}병</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 8, borderRadius: 2, background: 'var(--action)', display: 'inline-block' }} />
          평균 이상
          <span style={{ width: 12, height: 8, borderRadius: 2, background: '#C4A0A0', display: 'inline-block', marginLeft: 8 }} />
          평균 이하
        </span>
      </div>
    </div>
  );
});
