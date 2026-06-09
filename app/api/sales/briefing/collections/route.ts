import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { computeDueDate, type PaymentType } from '@/app/sales/outstanding/lib/dueDate';

// 오늘의 수금 브리핑: 매니저 거래처 중 연체(예정일 경과)/오늘 수금약속/약속어김 추출.
// wine·glass 모두 조회해 합친다.
const isAdmin = (r: string) => r === 'admin' || r === 'executive' || r === 'sales_admin';

interface CollItem {
  client_code: string; client_type: string; client_name: string;
  net_balance: number; overdue: number; days_overdue: number;
  due_date: string | null; oldest_unpaid_date: string | null;
  promised_date: string | null; promised_amount: number | null;
  stage: number; status: string; special: boolean; hidden: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST

    const [wine, glass, fo] = await Promise.all([
      supabase.rpc('calc_wine_aging', { p_manager: manager, p_as_of: today }),
      supabase.rpc('calc_glass_aging', { p_manager: manager, p_as_of: today }),
      supabase.from('collection_followups')
        .select('client_code, client_type, stage, status, promised_date, promised_amount, payment_type, hidden').eq('manager', manager),
    ]);

    const foMap = new Map<string, { stage: number; status: string; promised_date: string | null; promised_amount: number | null; payment_type: string | null; hidden: boolean }>();
    for (const f of (fo.data || [])) foMap.set(`${f.client_code}|${f.client_type}`, f);

    const days = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const build = (rows: any[], type: string): CollItem[] => (rows || []).map((r) => {
      const f = foMap.get(`${r.client_code}|${type}`);
      // 경과일 = 결제조건상 만기일(약속된 결제일)로부터. 만기일 산출 불가 시 출고일 기준 fallback.
      const dueDate = computeDueDate((f?.payment_type as PaymentType | null) ?? null, r.oldest_unpaid_date ?? null);
      const daysOverdue = dueDate ? days(today, dueDate)
        : (r.oldest_unpaid_date ? days(today, r.oldest_unpaid_date) : 0);
      return {
        client_code: r.client_code, client_type: type, client_name: r.client_name,
        net_balance: r.net_balance, overdue: r.overdue,
        days_overdue: daysOverdue, due_date: dueDate, oldest_unpaid_date: r.oldest_unpaid_date ?? null,
        promised_date: f?.promised_date ?? null, promised_amount: f?.promised_amount ?? null,
        stage: f?.stage ?? 0, status: f?.status ?? 'open',
        special: r.overdue > 0 && daysOverdue >= 30,
        hidden: f?.hidden ?? false,
      };
    });

    const all = [...build(wine.data, 'wine'), ...build(glass.data, 'glass')];

    const promiseToday: CollItem[] = [], broken: CollItem[] = [], overdue: CollItem[] = [];
    for (const it of all) {
      if (it.status === 'paid' || it.net_balance <= 0) continue;
      if (it.promised_date === today) { promiseToday.push(it); continue; }
      if (it.promised_date && it.promised_date < today) { broken.push(it); continue; }
      if (it.overdue > 0) overdue.push(it);
    }
    const byOverdue = (a: CollItem, b: CollItem) => b.overdue - a.overdue || b.days_overdue - a.days_overdue;
    promiseToday.sort((a, b) => b.net_balance - a.net_balance);
    broken.sort(byOverdue);
    overdue.sort(byOverdue);

    return NextResponse.json({
      today, promiseToday, broken, overdue,
      counts: {
        promiseToday: promiseToday.length, broken: broken.length,
        overdue: overdue.length, special: overdue.filter(o => o.special).length,
      },
    });
  } catch (err) {
    console.error('GET /api/sales/briefing/collections error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
