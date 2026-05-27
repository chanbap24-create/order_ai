'use client';

import { memo, useMemo } from 'react';
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

export const TrendChart = memo(function TrendChart({ dailyTrend, period, onPeriodChange }: Props) {
  // 차트 데이터 변환: 데이터/주기 변경 시만 재계산 (대용량 dailyTrend 에서 효과)
  const chartData = useMemo(() => {
    const aggregated = aggregateTrend(dailyTrend, period);
    return computeDiscountSeries(aggregated);
  }, [dailyTrend, period]);

  const { rateMin, rateMax } = useMemo(() => {
    const rates = chartData.map(d => d.discountRate).filter((v): v is number => v != null);
    return {
      rateMax: rates.length > 0 ? Math.ceil(Math.max(...rates) / 5) * 5 + 5 : 30,
      rateMin: rates.length > 0 ? Math.max(0, Math.floor(Math.min(...rates) / 5) * 5 - 5) : 0,
    };
  }, [chartData]);

  if (dailyTrend.length === 0) return null;

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
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.01em' }}>매출 · 지원률 추이</h3>
        <div style={{ display: 'flex', height: 28 }}>
          {([
            { value: 'daily', label: '일간' },
            { value: 'weekly', label: '주간' },
            { value: 'monthly', label: '월간' },
          ] as const).map((o, idx, arr) => {
            const isActive = period === o.value;
            return (
              <button
                key={o.value}
                onClick={() => onPeriodChange(o.value)}
                style={{
                  minWidth: 56,
                  padding: '0 12px',
                  border: '1px solid var(--border-default)',
                  background: isActive ? 'var(--action)' : 'var(--surface)',
                  color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: idx === 0 ? '6px 0 0 6px' : idx === arr.length - 1 ? '0 6px 6px 0' : 0,
                  borderLeftWidth: idx === 0 ? 1 : 0,
                  letterSpacing: '0.02em',
                }}
              >
                {o.label}
              </button>
            );
          })}
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
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#5A1515" strokeWidth={2} dot={chartData.length < 40} name="revenue" animationDuration={500} />
            <Line yAxisId="right" type="monotone" dataKey="discountRate" stroke="#4D96FF" strokeWidth={2} dot={chartData.length < 40} name="discountRate" connectNulls animationDuration={500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});
