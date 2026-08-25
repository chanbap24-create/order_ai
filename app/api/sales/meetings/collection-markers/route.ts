import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { fetchAllRows } from '@/app/lib/fetchAll';

// 미팅 달력용 수금 마커: 브리핑에서 수금일+금액을 모두 지정한 거래처만 그 약속일에 표시.
const isAdmin = (r: string) => r === 'admin' || r === 'executive' || r === 'sales_admin';

interface Marker {
  date: string; client_code: string; client_type: string; client_name: string;
  amount: number; kind: 'promise' | 'broken' | 'special'; special: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;
    const from = searchParams.get('date_from') || '';
    const to = searchParams.get('date_to') || '';
    if (!manager || !from || !to) return NextResponse.json({ markers: [] });

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

    // aging RPC(SETOF) 1000행 캡 — 페이지네이션
    const [wine, glass, fo] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchAllRows<any>((f, t) => supabase.rpc('calc_wine_aging', { p_manager: manager, p_as_of: today }).range(f, t)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchAllRows<any>((f, t) => supabase.rpc('calc_glass_aging', { p_manager: manager, p_as_of: today }).range(f, t)),
      supabase.from('collection_followups')
        .select('client_code, client_type, status, promised_date, promised_amount').eq('manager', manager),
    ]);

    const foMap = new Map<string, { status: string; promised_date: string | null; promised_amount: number | null }>();
    for (const f of (fo.data || [])) foMap.set(`${f.client_code}|${f.client_type}`, f);
    const days = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
    const inRange = (d: string) => d >= from && d <= to;

    const markers: Marker[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scan = (rows: any[], type: string) => (rows || []).forEach((r) => {
      if (r.net_balance <= 0) return;
      const f = foMap.get(`${r.client_code}|${type}`);
      if (!f || f.status === 'paid') return;
      // 브리핑에서 수금일·금액을 모두 지정한 거래처만, 그 약속일(범위 내)에 표시.
      if (!f.promised_date || f.promised_amount == null || !inRange(f.promised_date)) return;
      const special = r.overdue > 0 && r.oldest_unpaid_date != null && days(today, r.oldest_unpaid_date) >= 30;
      markers.push({
        client_code: r.client_code, client_type: type, client_name: r.client_name,
        amount: f.promised_amount, special,
        date: f.promised_date, kind: f.promised_date < today ? 'broken' : 'promise',
      });
    });
    scan(wine, 'wine');
    scan(glass, 'glass');

    return NextResponse.json({ markers });
  } catch (err) {
    console.error('GET /api/sales/meetings/collection-markers error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
