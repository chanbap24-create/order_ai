'use client';

import { PieChart, Pie, Cell, Tooltip } from 'recharts';

type Props = {
  data: Array<{ name: string; revenue: number }>;
  colors: string[];
  label?: string;
};

export function BizPieChart({ data: chartData, colors, label = '매출' }: Props) {
  if (!chartData || chartData.length === 0) return null;
  return (
    <PieChart width={170} height={170}>
      <Pie
        data={chartData}
        dataKey="revenue"
        nameKey="name"
        cx="50%" cy="50%"
        outerRadius={70}
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
      <Tooltip formatter={(value: number) => [`${value.toLocaleString()}원`, label]} />
    </PieChart>
  );
}
