'use client';

import Card from '@/app/components/ui/Card';
import { PIE_COLORS } from '../constants';
import { formatKrw } from '../lib/format';
import { BizPieChart } from './BizPieChart';

type Props = {
  title: string;
  data: Array<{ name: string; revenue: number }>;
  total: number;
  label?: string;
};

export function PieAnalysisCard({ title, data, total, label = '매출' }: Props) {
  if (data.length === 0) return null;
  const chartData = data.slice(0, 10);

  return (
    <Card>
      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--color-text-light)' }}>
        {title}
      </h4>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 170, height: 170, flexShrink: 0 }}>
          <BizPieChart data={chartData} colors={PIE_COLORS} label={label} />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
            <tbody>
              {chartData.map((b, i) => (
                <tr key={b.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '3px 6px' }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                      background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 4,
                    }} />
                    {b.name}
                  </td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>
                    {formatKrw(b.revenue)}
                  </td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--color-text-light)' }}>
                    {total > 0 ? ((b.revenue / total) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
