import type { TrendPeriod, TrendPoint } from '../types';

export function aggregateTrend(daily: TrendPoint[], period: TrendPeriod): TrendPoint[] {
  if (period === 'daily') return daily;

  const map = new Map<string, { revenue: number; normal_total: number; selling_total: number }>();

  for (const d of daily) {
    let key: string;
    if (period === 'weekly') {
      const dt = new Date(d.date);
      const day = dt.getDay();
      const mon = new Date(dt);
      mon.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
      key = mon.toISOString().slice(0, 10);
    } else {
      key = d.date.slice(0, 7);
    }
    const prev = map.get(key) || { revenue: 0, normal_total: 0, selling_total: 0 };
    map.set(key, {
      revenue: prev.revenue + d.revenue,
      normal_total: prev.normal_total + (d.normal_total || 0),
      selling_total: prev.selling_total + (d.selling_total || 0),
    });
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeDiscountSeries(trend: TrendPoint[]) {
  return trend.map(d => ({
    date: d.date,
    revenue: d.revenue,
    discountRate: d.normal_total > 0
      ? Math.round((d.normal_total - d.selling_total) / d.normal_total * 1000) / 10
      : null as number | null,
  }));
}
