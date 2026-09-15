// 소믈리에 관리자 통계 — 계정(직원)별 실적 집계. 권한자(박경아·조성재·admin)만.
// 지표: 신규 손님 등록 · 상담(문답 세션) · 판매 병수/금액 · 전환율 · 재방문 상담 + 인기 와인.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { canEditDiscounts } from '@/app/lib/sommelierDiscount';
import { handleApiError } from '@/app/lib/errors';

/** 기간 컷오프 — days=0은 오늘(KST 자정), null은 전체 */
function cutoffOf(days: number | null): string | null {
  if (days == null) return null;
  if (days === 0) {
    const kstNow = new Date(Date.now() + 9 * 3600_000);
    const kstMidnight = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 3600_000;
    return new Date(kstMidnight).toISOString();
  }
  return new Date(Date.now() - days * 86400_000).toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    if (!canEditDiscounts(session)) {
      return NextResponse.json({ success: false, error: '관리자 권한이 없습니다.' }, { status: 403 });
    }
    const daysParam = req.nextUrl.searchParams.get('days');
    const days = daysParam == null || daysParam === 'all' ? null : Math.max(0, Number(daysParam) || 0);
    const cutoff = cutoffOf(days);

    // 소믈리에 데이터는 소규모(세션 수백 건) — 행 페치 후 JS 집계로 충분
    let sessQ = supabase.from('sommelier_sessions').select('id, customer_id, manager, created_at');
    let ordQ = supabase.from('sommelier_orders').select('id, session_id, manager, item_code, item_name, retail_price, quantity, created_at');
    let custQ = supabase.from('sommelier_customers').select('id, created_by, created_at');
    if (cutoff) { sessQ = sessQ.gte('created_at', cutoff); ordQ = ordQ.gte('created_at', cutoff); custQ = custQ.gte('created_at', cutoff); }
    const [{ data: sess }, { data: ords }, { data: custs }, { data: allSess }] = await Promise.all([
      sessQ, ordQ, custQ,
      supabase.from('sommelier_sessions').select('id, customer_id, created_at'), // 재방문 판정용 전체 이력
    ]);

    // 고객별 최초 상담 시각 (재방문 = 그보다 뒤의 상담)
    const firstSession = new Map<number, string>();
    for (const s of allSess || []) {
      const cur = firstSession.get(s.customer_id);
      if (!cur || s.created_at < cur) firstSession.set(s.customer_id, s.created_at);
    }

    type Row = { manager: string; customers: number; sessions: number; revisits: number; bottles: number; amount: number; orderedSessions: Set<number | null> };
    const byMgr = new Map<string, Row>();
    const row = (m: string): Row => {
      const key = m || '(미상)';
      if (!byMgr.has(key)) byMgr.set(key, { manager: key, customers: 0, sessions: 0, revisits: 0, bottles: 0, amount: 0, orderedSessions: new Set() });
      return byMgr.get(key)!;
    };

    for (const c of custs || []) row(c.created_by).customers += 1;
    for (const s of sess || []) {
      const r = row(s.manager);
      r.sessions += 1;
      if (firstSession.get(s.customer_id) && s.created_at > firstSession.get(s.customer_id)!) r.revisits += 1;
    }
    for (const o of ords || []) {
      const r = row(o.manager);
      const qty = Number(o.quantity) || 1;
      r.bottles += qty;
      r.amount += (Number(o.retail_price) || 0) * qty;
      r.orderedSessions.add(o.session_id ?? null);
    }

    const managers = [...byMgr.values()]
      .map((r) => ({
        manager: r.manager,
        customers: r.customers,
        sessions: r.sessions,
        revisits: r.revisits,
        bottles: r.bottles,
        amount: r.amount,
        conversion: r.sessions > 0 ? Math.round((r.orderedSessions.size / r.sessions) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount || b.bottles - a.bottles || b.sessions - a.sessions);

    // 인기 와인 TOP 5 (기록 병수 기준)
    const byWine = new Map<string, { item_code: string; name: string; bottles: number; amount: number }>();
    for (const o of ords || []) {
      const w = byWine.get(o.item_code) || { item_code: o.item_code, name: o.item_name || o.item_code, bottles: 0, amount: 0 };
      const qty = Number(o.quantity) || 1;
      w.bottles += qty; w.amount += (Number(o.retail_price) || 0) * qty;
      byWine.set(o.item_code, w);
    }
    const topWines = [...byWine.values()].sort((a, b) => b.bottles - a.bottles || b.amount - a.amount).slice(0, 5);

    const total = {
      customers: (custs || []).length,
      sessions: (sess || []).length,
      bottles: managers.reduce((a, m) => a + m.bottles, 0),
      amount: managers.reduce((a, m) => a + m.amount, 0),
    };

    return NextResponse.json({ success: true, managers, topWines, total });
  } catch (e) {
    return handleApiError(e);
  }
}
