// app/lib/todaySummary.ts
// 홈 대시보드 요약 — 로그인 담당자 기준 '오늘' 스냅샷.
//   · 오늘 미팅: meetings (KST 오늘, 담당자 스코프)
//   · 와인 미수: calc_wine_outstanding RPC (미수현황 탭과 동일 계산, as-of 오늘)
import { supabase } from './db';

export interface TodayMeeting {
  client_name: string;
  meeting_time: string | null;
  meeting_type: string | null;
  status: string | null;
}

export interface HomeSummary {
  manager: string;
  today: string; // KST YYYY-MM-DD
  todayMeetings: TodayMeeting[];
  outstanding: {
    total: number;                                // 미수 총액(>0 합)
    count: number;                                // 미수 거래처 수
    top: Array<{ client_name: string; amount: number }>; // 상위 3
  };
  /** 윈백 성과 — 최근 30일 발송·재주문 전환 (없으면 null) */
  winback: { sent: number; converted: number } | null;
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function getHomeSummary(manager: string): Promise<HomeSummary> {
  const today = todayKST();
  const yearStart = `${today.slice(0, 4)}-01-01`; // RPC는 이월(prev_balance) 포함이라 as-of 결과는 시작일과 무관

  const [meetingsRes, outRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('client_name, meeting_time, meeting_type, status')
      .eq('meeting_date', today)
      .eq('manager', manager)
      .order('meeting_time', { ascending: true }),
    supabase.rpc('calc_wine_outstanding', {
      p_manager: manager,
      p_start_date: yearStart,
      p_end_date: today,
    }),
  ]);

  const rows = (outRes.data || []) as Array<{ client_name: string; outstanding: number }>;
  const owed = rows.filter((r) => (r.outstanding || 0) > 0);
  const total = owed.reduce((s, r) => s + r.outstanding, 0);
  const top = [...owed]
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 3)
    .map((r) => ({ client_name: r.client_name, amount: r.outstanding }));

  return {
    manager,
    today,
    todayMeetings: (meetingsRes.data || []) as TodayMeeting[],
    outstanding: { total, count: owed.length, top },
    winback: await getWinbackStats(manager, today),
  };
}

/** 최근 30일 윈백 발송 거래처 수 + 발송 후 재주문 전환 수 (담당자 스코프) */
async function getWinbackStats(manager: string, today: string): Promise<{ sent: number; converted: number } | null> {
  const since = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: recos } = await supabase
    .from('recommendations')
    .select('client_code, created_at')
    .eq('recommendation_type', 'winback')
    .gte('created_at', since);
  if (!recos || recos.length === 0) return null;

  // 담당자 스코프: 현재 담당(client_details.manager) 거래처만
  const codes = [...new Set(recos.map((r) => r.client_code).filter(Boolean))];
  const mine = new Set<string>();
  for (let i = 0; i < codes.length; i += 300) {
    const { data } = await supabase.from('client_details')
      .select('client_code').eq('manager', manager).eq('client_type', 'wine')
      .in('client_code', codes.slice(i, i + 300));
    for (const r of (data || [])) mine.add(r.client_code);
  }
  // 거래처별 최초 발송일
  const firstSent = new Map<string, string>();
  for (const r of recos) {
    if (!r.client_code || !mine.has(r.client_code)) continue;
    const d = String(r.created_at).slice(0, 10);
    if (!firstSent.has(r.client_code) || d < firstSent.get(r.client_code)!) firstSent.set(r.client_code, d);
  }
  if (firstSent.size === 0) return null;

  // 전환 = 발송일 이후 출고 존재
  let converted = 0;
  const sentCodes = [...firstSent.keys()];
  for (let i = 0; i < sentCodes.length; i += 100) {
    const batch = sentCodes.slice(i, i + 100);
    const minDate = batch.reduce((m, c) => (firstSent.get(c)! < m ? firstSent.get(c)! : m), today);
    const { data: ships } = await supabase.from('shipments')
      .select('client_code, ship_date')
      .in('client_code', batch).gt('ship_date', minDate)
      .limit(2000);
    const shippedAfter = new Set<string>();
    for (const s of (ships || [])) {
      if (s.client_code && String(s.ship_date).slice(0, 10) > firstSent.get(s.client_code)!) {
        shippedAfter.add(s.client_code);
      }
    }
    converted += shippedAfter.size;
  }
  return { sent: firstSent.size, converted };
}
