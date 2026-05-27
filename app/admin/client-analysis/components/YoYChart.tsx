'use client';

import { memo, useMemo } from 'react';
import Card from '@/app/components/ui/Card';
import type { TrendPoint } from '../types';
import { formatKrw } from '../lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from '../lib/recharts';

type Props = {
  thisYearTrend: TrendPoint[];
  lastYearTrend: TrendPoint[];
  startDate: string;
};

export const YoYChart = memo(function YoYChart({ thisYearTrend, lastYearTrend, startDate }: Props) {
  // 월별 집계 + 합계 + 성장률 — 입력 데이터 변경 시만 재계산
  const agg = useMemo(() => {
    const thisYearMonthly = new Map<string, number>();
    for (const d of thisYearTrend) {
      const m = d.date.slice(5, 7);
      thisYearMonthly.set(m, (thisYearMonthly.get(m) || 0) + d.revenue);
    }
    const lastYearMonthly = new Map<string, number>();
    for (const d of lastYearTrend) {
      const m = d.date.slice(5, 7);
      lastYearMonthly.set(m, (lastYearMonthly.get(m) || 0) + d.revenue);
    }
    const allMonths = [
      ...new Set([...thisYearMonthly.keys(), ...lastYearMonthly.keys()]),
    ].sort();
    const thisYear = startDate.slice(0, 4);
    const lastYear = String(Number(thisYear) - 1);
    const yoyData = allMonths.map((m) => ({
      month: `${Number(m)}월`,
      [lastYear]: Math.round((lastYearMonthly.get(m) || 0) / 10000),
      [thisYear]: Math.round((thisYearMonthly.get(m) || 0) / 10000),
    }));
    const thisYearTotal = [...thisYearMonthly.values()].reduce((s, v) => s + v, 0);
    const lastYearTotal = [...lastYearMonthly.values()].reduce((s, v) => s + v, 0);
    const growthRate =
      lastYearTotal > 0
        ? (((thisYearTotal - lastYearTotal) / lastYearTotal) * 100).toFixed(1)
        : null;
    return { yoyData, allMonths, thisYear, lastYear, thisYearTotal, lastYearTotal, growthRate };
  }, [thisYearTrend, lastYearTrend, startDate]);

  const { yoyData, allMonths, thisYear, lastYear, thisYearTotal, lastYearTotal, growthRate } = agg;

  if (thisYearTrend.length === 0) return null;
  if (allMonths.length === 0) return null;

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.01em' }}>전년 대비 매출 비교</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>
            {lastYear}년 <b style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatKrw(lastYearTotal)}</b>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            {thisYear}년 <b style={{ color: 'var(--action)', fontVariantNumeric: 'tabular-nums' }}>{formatKrw(thisYearTotal)}</b>
          </span>
          {growthRate != null && (
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11,
              background: Number(growthRate) >= 0 ? 'rgba(198,40,40,0.08)' : 'rgba(21,101,192,0.08)',
              color: Number(growthRate) >= 0 ? '#C62828' : '#1565C0',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {Number(growthRate) >= 0 ? '+' : ''}{growthRate}%
            </span>
          )}
        </div>
      </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={yoyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toLocaleString()}만`} width={60} />
            <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()}만원`, `${name}년`]} />
            <Legend formatter={(value: string) => `${value}년`} />
            <Bar dataKey={lastYear} fill="#D1D5DB" radius={[4, 4, 0, 0]} animationDuration={500} />
            <Bar dataKey={thisYear} fill="#5A1515" radius={[4, 4, 0, 0]} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});
