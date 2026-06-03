import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

// 미팅 달력용 수금 마커: 브리핑에서 수금일+금액을 모두 지정한 거래처만 그 약속일에 표시.
// 최적화: 표시 대상은 promised_date+금액이 설정된 소수 거래처뿐이므로,
//   그 거래처 코드만 aging RPC(p_codes)로 넘겨 계산 → 전체 aging(~2초) 회피.
//   설정된 약속이 없으면 RPC 자체를 호출하지 않음.
const isAdmin = (r: string) => r === 'admin' || r === 'executive' || r === 'sales_admin';

interface Marker {
  date: string; client_code: string; client_type: string; client_name: string;
  amount: number; kind: 'promise' | 'broken' | 'special'; special: boolean;
}
interface Followup { client_code: string; client_type: string; promised_date: string; promised_amount: number; }
interface AgingRow { client_code: string; client_name: string; net_balance: number; overdue: number; oldest_unpaid_date: string | null; }

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

    // 1) 범위 내 "약속일+금액 모두 지정, 미수 상태" followup 만 추출(표시 후보).
    const { data: foData } = await supabase
      .from('collection_followups')
      .select('client_code, client_type, promised_date, promised_amount')
      .eq('manager', manager)
      .neq('status', 'paid')
      .not('promised_date', 'is', null)
      .not('promised_amount', 'is', null)
      .gte('promised_date', from)
      .lte('promised_date', to);

    const followups = (foData || []) as Followup[];
    if (followups.length === 0) return NextResponse.json({ markers: [] });

    const wineCodes = followups.filter(f => f.client_type === 'wine').map(f => f.client_code);
    const glassCodes = followups.filter(f => f.client_type === 'glass').map(f => f.client_code);

    // 2) 후보 거래처만 aging 계산(p_codes). 해당 타입 후보 없으면 호출 생략.
    const [wine, glass] = await Promise.all([
      wineCodes.length
        ? supabase.rpc('calc_wine_aging', { p_manager: manager, p_as_of: today, p_codes: wineCodes })
        : Promise.resolve({ data: [] as AgingRow[] }),
      glassCodes.length
        ? supabase.rpc('calc_glass_aging', { p_manager: manager, p_as_of: today, p_codes: glassCodes })
        : Promise.resolve({ data: [] as AgingRow[] }),
    ]);

    const agingMap = new Map<string, AgingRow>();
    for (const r of ((wine.data || []) as AgingRow[])) agingMap.set(`${r.client_code}|wine`, r);
    for (const r of ((glass.data || []) as AgingRow[])) agingMap.set(`${r.client_code}|glass`, r);

    const days = (a: string, b: string) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

    const markers: Marker[] = [];
    for (const f of followups) {
      const r = agingMap.get(`${f.client_code}|${f.client_type}`);
      if (!r || r.net_balance <= 0) continue; // 이미 완납 → 표시 안 함
      const special = r.overdue > 0 && r.oldest_unpaid_date != null && days(today, r.oldest_unpaid_date) >= 30;
      markers.push({
        client_code: f.client_code, client_type: f.client_type, client_name: r.client_name,
        amount: f.promised_amount, special,
        date: f.promised_date, kind: f.promised_date < today ? 'broken' : 'promise',
      });
    }

    return NextResponse.json({ markers });
  } catch (err) {
    console.error('GET /api/sales/meetings/collection-markers error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
