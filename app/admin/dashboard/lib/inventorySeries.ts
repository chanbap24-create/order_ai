import type { DashboardStats } from '@/app/types/wine';
import type { InvPeriod } from '../types';

export function computeInvChanges(history: DashboardStats['inventoryHistory']) {
  const out: Array<{ date: string; cdv: number; dl: number }> = [];
  if (history.length < 2) return out;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    out.push({
      date: curr.recorded_date.slice(5),
      cdv: Math.round((curr.cdv_value - prev.cdv_value) / 1_0000),
      dl: Math.round((curr.dl_value - prev.dl_value) / 1_0000),
    });
  }
  return out;
}

export function computeInvLineSeries(history: DashboardStats['inventoryHistory'], period: InvPeriod) {
  const out: Array<{ date: string; cdv: number; dl: number }> = [];
  if (history.length === 0) return out;

  if (period === 'daily') {
    for (const h of history) {
      out.push({
        date: h.recorded_date.slice(5),
        cdv: Math.round(h.cdv_value / 1_0000),
        dl: Math.round(h.dl_value / 1_0000),
      });
    }
    return out;
  }

  const grouped = new Map<string, { cdv: number; dl: number }>();
  for (const h of history) {
    let key: string;
    if (period === 'weekly') {
      const dt = new Date(h.recorded_date);
      const day = dt.getDay();
      const mon = new Date(dt);
      mon.setDate(dt.getDate() - ((day + 6) % 7));
      key = mon.toISOString().slice(0, 10);
    } else {
      key = h.recorded_date.slice(0, 7);
    }
    grouped.set(key, { cdv: Math.round(h.cdv_value / 1_0000), dl: Math.round(h.dl_value / 1_0000) });
  }
  for (const [k, v] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const label = period === 'weekly' ? k.slice(5) : k.slice(2).replace('-', '/');
    out.push({ date: label, ...v });
  }
  return out;
}
