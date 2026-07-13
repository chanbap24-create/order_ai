// app/lib/dormantClients.ts
// 거래처 발주 리듬 판정 — 절대 개월수가 아니라 '본인 발주 주기' 기준.
//   · 이탈위험(risk): 마지막 발주 후 경과가 본인 평균 주기의 2배 이상 (최소 30일)
//   · 휴면(dormant): 3배 이상 (최소 45일)
//   · 발주 1회뿐(주기 미상): 보수적으로 60/90일 기준
// 추천견적 생성 시 이 판정으로 윈백 가산(discountRate의 winback)이 자동 적용된다.
import { supabase } from './db';

export type WinbackStatus = 'dormant' | 'risk';

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}
function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** 출고일 배열(중복 제거·오름차순)로 판정. 리듬 = 최근 6개 간격 중앙값(최소 7일). */
export function judgeWinbackStatus(shipDates: string[], today: string): WinbackStatus | null {
  const dates = [...new Set(shipDates)].sort();
  if (dates.length === 0) return null;
  const last = dates[dates.length - 1];
  const elapsed = daysBetween(today, last);

  const intervals: number[] = [];
  for (let i = Math.max(1, dates.length - 6); i < dates.length; i++) {
    intervals.push(daysBetween(dates[i], dates[i - 1]));
  }
  if (intervals.length >= 1) {
    const interval = Math.max(7, median(intervals));
    if (elapsed >= Math.max(45, interval * 3)) return 'dormant';
    if (elapsed >= Math.max(30, interval * 2)) return 'risk';
    return null;
  }
  // 발주 1회뿐(주기 미상)
  if (elapsed >= 90) return 'dormant';
  if (elapsed >= 60) return 'risk';
  return null;
}

/** 거래처 1곳의 윈백 상태 — 최근 출고일부터 역순 조회(1000행 캡 안에서 최신 리듬 확보). */
export async function getClientWinbackStatus(clientCode: string): Promise<WinbackStatus | null> {
  const { data } = await supabase
    .from('shipments')
    .select('ship_date')
    .eq('client_code', clientCode)
    .order('ship_date', { ascending: false })
    .limit(1000);
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dates = (data || []).map((r) => String(r.ship_date || '').slice(0, 10)).filter(Boolean);
  return judgeWinbackStatus(dates, today);
}
