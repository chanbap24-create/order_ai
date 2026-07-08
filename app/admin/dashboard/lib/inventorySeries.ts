import type { DashboardStats } from '@/app/types/wine';
import type { InvPeriod } from '../types';

// 0/누락(그날 한쪽 법인 파일 미업로드 등)은 직전 유효값으로 이어받아
// 추이 그래프가 급락/급등으로 깨지는 것을 방지. (예: 2026-03-13 DL=0)
function carryForward(history: DashboardStats['inventoryHistory']): DashboardStats['inventoryHistory'] {
  let lastCdv = 0, lastDl = 0;
  return history.map((h) => {
    const cdv = Number(h.cdv_value) > 0 ? Number(h.cdv_value) : lastCdv;
    const dl = Number(h.dl_value) > 0 ? Number(h.dl_value) : lastDl;
    lastCdv = cdv; lastDl = dl;
    return { ...h, cdv_value: cdv, dl_value: dl };
  });
}

export function computeInvChanges(historyRaw: DashboardStats['inventoryHistory']) {
  const history = carryForward(historyRaw);
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

export function computeInvLineSeries(historyRaw: DashboardStats['inventoryHistory'], period: InvPeriod) {
  const history = carryForward(historyRaw);
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
