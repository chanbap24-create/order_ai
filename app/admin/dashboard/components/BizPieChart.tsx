'use client';

import dynamic from 'next/dynamic';

type Props = {
  data: Array<{ name: string; revenue: number }>;
  colors: string[];
  label?: string;
};

// Cell 이 dynamic child 로는 인식이 안되므로 PieChart+Pie+Cell 를 통째로 묶어서 dynamic import
export const BizPieChart = dynamic(() => import('recharts').then(mod => {
  const { PieChart, Pie, Cell, Tooltip } = mod;

  function BizPieInner({ data: chartData, colors, label = '매출' }: Props) {
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

  return BizPieInner;
}), { ssr: false });
