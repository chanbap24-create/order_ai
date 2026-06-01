import { supabase } from './db';

// 매니저별 '오늘 챙길 미수' 요약 (알림톡 발송용).
// 연령분석 RPC(wine/glass) + collection_followups 를 합쳐 약속어김/연체/특별관리 집계.

export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export interface ManagerCollectionSummary {
  manager: string;
  broken: number;      // 약속 어김
  overdue: number;     // 결제예정일 경과
  special: number;     // 특별관리(30일+)
  total: number;       // 약속어김 + 연체
  topName: string;     // 대표(최대) 거래처명
  topAmount: number;   // 대표 금액
}

export async function buildManagerSummary(manager: string, asOf = kstToday()): Promise<ManagerCollectionSummary> {
  const [wine, glass, fo] = await Promise.all([
    supabase.rpc('calc_wine_aging', { p_manager: manager, p_as_of: asOf }),
    supabase.rpc('calc_glass_aging', { p_manager: manager, p_as_of: asOf }),
    supabase.from('collection_followups').select('client_code, client_type, status, promised_date').eq('manager', manager),
  ]);

  const foMap = new Map<string, { status: string; promised_date: string | null }>();
  for (const f of (fo.data || [])) foMap.set(`${f.client_code}|${f.client_type}`, f);
  const days = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

  let broken = 0, overdue = 0, special = 0;
  let topName = '', topAmount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scan = (rows: any[], type: string) => (rows || []).forEach((r) => {
    if (r.net_balance <= 0) return;
    const f = foMap.get(`${r.client_code}|${type}`);
    if (f?.status === 'paid') return;
    const isBroken = !!f?.promised_date && f.promised_date < asOf;
    const isOverdue = r.overdue > 0;
    if (!isBroken && !isOverdue) return;
    const amount = r.overdue > 0 ? r.overdue : r.net_balance;
    if (isBroken) broken++; else overdue++;
    if (isOverdue && r.oldest_unpaid_date && days(asOf, r.oldest_unpaid_date) >= 30) special++;
    if (amount > topAmount) { topAmount = amount; topName = r.client_name; }
  });

  scan(wine.data, 'wine');
  scan(glass.data, 'glass');

  return { manager, broken, overdue, special, total: broken + overdue, topName, topAmount };
}
