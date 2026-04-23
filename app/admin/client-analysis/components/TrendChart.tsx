'use client';

import Card from '@/app/components/ui/Card';
import type { TrendPeriod, TrendPoint } from '../types';
import { formatKrw, formatDateShort } from '../lib/format';
import { aggregateTrend, computeDiscountSeries } from '../lib/trendAgg';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from '../lib/recharts';

type Props = {
  dailyTrend: TrendPoint[];
  period: TrendPeriod;
  onPeriodChange: (p: TrendPeriod) => void;
};

export function TrendChart({ dailyTrend, period, onPeriodChange }: Props) {
  if (dailyTrend.length === 0) return null;

  const aggregated = aggregateTrend(dailyTrend, period);
  const chartData = computeDiscountSeries(aggregated);

  const rates = chartData.map(d => d.discountRate).filter((v): v is number => v != null);
  const rateMax = rates.length > 0 ? Math.ceil(Math.max(...rates) / 5) * 5 + 5 : 30;
  const rateMin = rates.length > 0 ? Math.max(0, Math.floor(Math.min(...rates) / 5) * 5 - 5) : 0;

  const tickFmt = (d: string) => {
    if (period === 'monthly') return d.slice(2).replace('-', '/');
    return formatDateShort(d);
  };
  const labelFmt = (d: string) => {
    if (period === 'weekly') return `${d} 주`;
    if (period === 'monthly') return `${d}`;
    return d;
  };

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>매출 · 지원률 추이</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => onPeriodChange(v)}
              style={{
                padding: '4px 12px', fontSize: 'var(--text-xs)', fontWeight: period === v ? 700 : 400,
                border: period === v ? '1px solid #8B1538' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: period === v ? 'rgba(139,21,56,0.08)' : 'var(--color-background)',
                color: period === v ? '#8B1538' : 'var(--color-text-light)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tickFormatter={(v: number) => formatKrw(v)} tick={{ fontSize: 11 }} width={60} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} width={45} domain={[rateMin, rateMax]} />
            <Tooltip
              formatter={(value: number | null, name: string) => {
                if (name === 'revenue') return [`${(value ?? 0).toLocaleString()}원`, '매출'];
                if (name === 'discountRate') return [value != null ? `${value}%` : '-', '지원률'];
                return [value, name];
              }}
              labelFormatter={labelFmt}
            />
            <Legend formatter={(value: string) => value === 'revenue' ? '매출' : '지원률'} />
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#8B1538" strokeWidth={2} dot={chartData.length < 40} name="revenue" />
            <Line yAxisId="right" type="monotone" dataKey="discountRate" stroke="#4D96FF" strokeWidth={2} dot={chartData.length < 40} name="discountRate" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
