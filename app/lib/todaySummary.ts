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
  };
}
