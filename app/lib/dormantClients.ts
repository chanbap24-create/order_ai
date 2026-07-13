// app/lib/dormantClients.ts
// 휴면·이탈위험 거래처 자동 발굴 — 절대 개월수가 아니라 '본인 발주 리듬' 기준.
//   · 이탈위험: 마지막 발주 후 경과가 본인 평균 주기의 2배 이상 (최소 30일)
//   · 휴면:    3배 이상 (최소 45일)
//   · 미수형:  미수 잔액 > 0 — 윈백 발송 대상에서 제외(수금 먼저), 배지로만 표시
// 대상: 최근 18개월 내 발주 이력이 있는 와인 거래처(현재 담당 기준).
import { supabase } from './db';

export interface DormantClient {
  client_code: string;
  client_name: string;
  business_type: string | null;
  last_order: string;          // 마지막 발주일
  avg_interval_days: number | null; // 본인 평균 발주주기(중앙값, 최근 6회 간격)
  elapsed_days: number;        // 마지막 발주 후 경과일
  status: 'dormant' | 'risk';
  outstanding: number;         // 미수 잔액(>0이면 미수형)
}

const LOOKBACK_MONTHS = 18;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}
function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export async function getDormantClients(manager: string): Promise<{
  clients: DormantClient[];
  counts: { dormant: number; risk: number; misu: number };
}> {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const since = new Date(Date.now() - LOOKBACK_MONTHS * 30 * 86400000).toISOString().slice(0, 10);

  // 1) 현재 담당의 와인 거래처 (페이지네이션 — 1000행 캡 주의)
  const clients: Array<{ client_code: string; client_name: string; business_type: string | null }> = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase.from('client_details')
      .select('client_code, client_name, business_type')
      .eq('manager', manager).eq('client_type', 'wine')
      .not('client_code', 'is', null)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    clients.push(...(data as typeof clients));
    if (data.length < 1000) break;
  }
  if (clients.length === 0) return { clients: [], counts: { dormant: 0, risk: 0, misu: 0 } };

  // 2) 18개월 출고일 수집 (코드 배치 + 행 페이지네이션)
  const datesByClient = new Map<string, Set<string>>();
  const codes = clients.map((c) => c.client_code);
  for (let i = 0; i < codes.length; i += 100) {
    const batch = codes.slice(i, i + 100);
    for (let from = 0; from < 50000; from += 1000) {
      const { data } = await supabase.from('shipments')
        .select('client_code, ship_date')
        .in('client_code', batch).gte('ship_date', since)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        const d = String(r.ship_date || '').slice(0, 10);
        if (!r.client_code || !d) continue;
        if (!datesByClient.has(r.client_code)) datesByClient.set(r.client_code, new Set());
        datesByClient.get(r.client_code)!.add(d);
      }
      if (data.length < 1000) break;
    }
  }

  // 3) 미수 잔액 (미수현황과 동일 RPC)
  const outstandingMap = new Map<string, number>();
  const { data: outRows } = await supabase.rpc('calc_wine_outstanding', {
    p_manager: manager, p_start_date: `${today.slice(0, 4)}-01-01`, p_end_date: today,
  });
  for (const r of (outRows || []) as Array<{ client_code: string; outstanding: number }>) {
    outstandingMap.set(r.client_code, Number(r.outstanding) || 0);
  }

  // 4) 판정 — 본인 리듬 기준
  const result: DormantClient[] = [];
  for (const c of clients) {
    const dates = [...(datesByClient.get(c.client_code) || [])].sort();
    if (dates.length === 0) continue; // 18개월 무거래(장기 사망)는 v1 제외 — 재생 가능성 높은 층에 집중
    const last = dates[dates.length - 1];
    const elapsed = daysBetween(today, last);

    // 최근 간격(최대 6개) 중앙값 = 본인 발주주기
    const intervals: number[] = [];
    for (let i = Math.max(1, dates.length - 6); i < dates.length; i++) {
      intervals.push(daysBetween(dates[i], dates[i - 1]));
    }
    const interval = intervals.length >= 1 ? Math.max(7, median(intervals)) : null;

    let status: DormantClient['status'] | null = null;
    if (interval != null) {
      if (elapsed >= Math.max(45, interval * 3)) status = 'dormant';
      else if (elapsed >= Math.max(30, interval * 2)) status = 'risk';
    } else {
      // 발주 1회뿐(주기 미상): 보수적으로 60/90일 기준
      if (elapsed >= 90) status = 'dormant';
      else if (elapsed >= 60) status = 'risk';
    }
    if (!status) continue;

    result.push({
      client_code: c.client_code,
      client_name: c.client_name,
      business_type: c.business_type,
      last_order: last,
      avg_interval_days: interval != null ? Math.round(interval) : null,
      elapsed_days: elapsed,
      status,
      outstanding: outstandingMap.get(c.client_code) || 0,
    });
  }

  // 살릴 확률 높은 순: 이탈위험(아직 안 죽음) 먼저 → 그 다음 휴면은 최근에 끊긴 순(경과 작은 순)
  result.sort((a, b) => (a.status === b.status ? a.elapsed_days - b.elapsed_days : a.status === 'risk' ? -1 : 1));

  return {
    clients: result,
    counts: {
      dormant: result.filter((r) => r.status === 'dormant').length,
      risk: result.filter((r) => r.status === 'risk').length,
      misu: result.filter((r) => r.outstanding > 0).length,
    },
  };
}
