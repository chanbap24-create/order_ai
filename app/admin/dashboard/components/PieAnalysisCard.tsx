'use client';

import { memo } from 'react';
import { Section } from '@/app/components/ui';
import { PIE_COLORS } from '../constants';
import { formatKrw } from '../lib/format';
import { BizPieChart } from './BizPieChart';

type Props = {
  title: string;
  data: Array<{ name: string; revenue: number }>;
  total: number;
  label?: string;
};

export const PieAnalysisCard = memo(function PieAnalysisCard({
  title,
  data,
  total,
  label = '매출',
}: Props) {
  if (data.length === 0) return null;
  const chartData = data.slice(0, 10);

  return (
    <Section title={title}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 170, height: 170, flexShrink: 0 }}>
          <BizPieChart data={chartData} colors={PIE_COLORS} label={label} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {chartData.map((b, i) => (
                <tr key={b.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '4px 6px', color: 'var(--text-primary)' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: PIE_COLORS[i % PIE_COLORS.length],
                        marginRight: 6,
                        verticalAlign: 'middle',
                      }}
                    />
                    {b.name}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatKrw(b.revenue)}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      textAlign: 'right',
                      color: 'var(--text-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {total > 0 ? ((b.revenue / total) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
});
