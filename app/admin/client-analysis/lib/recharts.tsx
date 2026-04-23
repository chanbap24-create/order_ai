'use client';

import dynamic from 'next/dynamic';
import type { NamedRevenue } from '../types';

export const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
export const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
export const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
export const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
export const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
export const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
export const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
export const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
export const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
export const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });

// PieChart는 Cell이 dynamic import 시 자식 인식 안 되므로 통째로 래핑
export const BizPieChart = dynamic(() => import('recharts').then(mod => {
  const { PieChart, Pie, Cell, Tooltip: RTooltip, ResponsiveContainer: RC } = mod;
  function BizPie({ data: chartData, colors }: { data: NamedRevenue[]; colors: string[] }) {
    return (
      <RC width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="revenue"
            nameKey="name"
            cx="50%" cy="50%"
            outerRadius={80}
            label={({ name, percent }: { name: string; percent: number }) =>
              percent > 0.05 ? `${name.length > 6 ? name.slice(0, 6) + '..' : name}` : ''
            }
            labelLine={false}
            style={{ fontSize: 10 }}
          >
            {chartData.map((_: unknown, i: number) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <RTooltip formatter={(value: number) => [`${value.toLocaleString()}원`, '매출']} />
        </PieChart>
      </RC>
    );
  }
  return BizPie;
}), { ssr: false });
