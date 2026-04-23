'use client';

import { memo } from 'react';
import Card from '@/app/components/ui/Card';
import type { AnalysisData, BizView } from '../types';
import { PIE_COLORS } from '../constants';
import { formatKrw } from '../lib/format';
import { BizPieChart } from '../lib/recharts';

type Props = {
  data: AnalysisData;
  view: BizView;
  onViewChange: (v: BizView) => void;
};

export const BusinessBrandPie = memo(function BusinessBrandPie({ data, view, onViewChange }: Props) {
  if (data.businessAnalysis.length === 0 && data.brandAnalysis.length === 0) return null;

  const chartData = view === 'business'
    ? data.businessAnalysis.slice(0, 10)
    : data.brandAnalysis.slice(0, 10);
  const totalRev = data.summary.totalRevenue;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
          {view === 'business' ? '업종별 매출' : '브랜드별 매출'}
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['business', 'brand'] as const).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              style={{
                padding: '4px 12px', fontSize: 'var(--text-xs)', fontWeight: view === v ? 700 : 400,
                border: view === v ? '1px solid #8B1538' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: view === v ? 'rgba(139,21,56,0.08)' : 'var(--color-background)',
                color: view === v ? '#8B1538' : 'var(--color-text-light)',
              }}
            >
              {v === 'business' ? '업종' : '브랜드'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 200, height: 200, flexShrink: 0 }}>
          <BizPieChart data={chartData} colors={PIE_COLORS} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
            <tbody>
              {chartData.map((b, i) => {
                const pct = totalRev > 0 ? ((b.revenue / totalRev) * 100).toFixed(1) : '0';
                return (
                  <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                        background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 6,
                      }} />
                      {b.name}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatKrw(b.revenue)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--color-text-light)' }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
});
