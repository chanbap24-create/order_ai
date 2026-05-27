'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { Section } from '@/app/components/ui';
import type { InvPeriod } from '../types';

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);

type Props = {
  invChangeData: Array<{ date: string; cdv: number; dl: number }>;
  inventoryLineData: Array<{ date: string; cdv: number; dl: number }>;
  invPeriod: InvPeriod;
  onPeriodChange: (p: InvPeriod) => void;
};

export const InventoryCharts = memo(function InventoryCharts({
  invChangeData,
  inventoryLineData,
  invPeriod,
  onPeriodChange,
}: Props) {
  if (invChangeData.length === 0 && inventoryLineData.length <= 1) return null;

  const legendFmt = (v: string) => (v === 'cdv' ? '까브드뱅' : '대유라이프');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {invChangeData.length > 0 && (
        <Section title="재고 변동 추이">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invChangeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={invChangeData.length > 15 ? Math.floor(invChangeData.length / 12) : 0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString()}만`}
                  width={65}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value > 0 ? '+' : ''}${value.toLocaleString()}만원`,
                    legendFmt(name),
                  ]}
                />
                <Legend formatter={legendFmt} />
                <Bar dataKey="cdv" fill="#5A1515" radius={[4, 4, 0, 0]} animationDuration={500} />
                <Bar dataKey="dl" fill="#1565C0" radius={[4, 4, 0, 0]} animationDuration={500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {inventoryLineData.length > 1 && (
        <Section
          title="재고금액 추이"
          actions={<PeriodToggle period={invPeriod} onChange={onPeriodChange} />}
        >
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={inventoryLineData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={
                    invPeriod === 'daily' && inventoryLineData.length > 15
                      ? Math.floor(inventoryLineData.length / 12)
                      : 0
                  }
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toLocaleString()}만`}
                  width={60}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.95),
                    (dataMax: number) => Math.ceil(dataMax * 1.02),
                  ]}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()}만원`,
                    legendFmt(name),
                  ]}
                />
                <Legend formatter={legendFmt} />
                <Line
                  type="monotone"
                  dataKey="cdv"
                  stroke="#5A1515"
                  strokeWidth={2}
                  dot={inventoryLineData.length < 20}
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="dl"
                  stroke="#1565C0"
                  strokeWidth={2}
                  dot={inventoryLineData.length < 20}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}
    </div>
  );
});

function PeriodToggle({
  period,
  onChange,
}: {
  period: InvPeriod;
  onChange: (p: InvPeriod) => void;
}) {
  const options: { value: InvPeriod; label: string }[] = [
    { value: 'daily', label: '일간' },
    { value: 'weekly', label: '주간' },
    { value: 'monthly', label: '월간' },
  ];
  return (
    <div style={{ display: 'flex', height: 26 }}>
      {options.map((o, idx) => {
        const isActive = period === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              minWidth: 44,
              padding: '0 10px',
              border: '1px solid var(--border-default)',
              background: isActive ? 'var(--action)' : 'var(--surface)',
              color: isActive ? 'var(--text-on-primary)' : 'var(--text-tertiary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius:
                idx === 0
                  ? '6px 0 0 6px'
                  : idx === options.length - 1
                    ? '0 6px 6px 0'
                    : 0,
              borderLeftWidth: idx === 0 ? 1 : 0,
              letterSpacing: '0.02em',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
