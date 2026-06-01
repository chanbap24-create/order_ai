import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

// 미팅 달력용 수금 마커: 수금약속일(promise/broken) + 특별관리(장기미수, 약속 없으면 오늘).
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

    const [wine, glass, fo] = await Promise.all([
      supabase.rpc('calc_wine_aging', { p_manager: manager, p_as_of: today }),
      supabase.rpc('calc_glass_aging', { p_manager: manager, p_as_of: today }),
      supabase.from('collection_followups')
        .select('client_code, client_type, status, promised_date').eq('manager', manager),
    ]);

    const foMap = new Map<string, { status: string; promised_date: string | null }>();
    for (const f of (fo.data || [])) foMap.set(`${f.client_code}|${f.client_type}`, f);
    const days = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
    const inRange = (d: string) => d >= from && d <= to;

    const markers: Marker[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scan = (rows: any[], type: string) => (rows || []).forEach((r) => {
      if (r.net_balance <= 0) return;
      const f = foMap.get(`${r.client_code}|${type}`);
      if (f?.status === 'paid') return;
      const amount = r.overdue > 0 ? r.overdue : r.net_balance;
      const special = r.overdue > 0 && r.oldest_unpaid_date != null && days(today, r.oldest_unpaid_date) >= 30;
      const base = { client_code: r.client_code, client_type: type, client_name: r.client_name, amount, special };

      if (f?.promised_date && inRange(f.promised_date)) {
        markers.push({ ...base, date: f.promised_date, kind: f.promised_date < today ? 'broken' : 'promise' });
      } else if (special && !f?.promised_date && inRange(today)) {
        markers.push({ ...base, date: today, kind: 'special' });
      }
    });
    scan(wine.data, 'wine');
    scan(glass.data, 'glass');

    return NextResponse.json({ markers });
  } catch (err) {
    console.error('GET /api/sales/meetings/collection-markers error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
