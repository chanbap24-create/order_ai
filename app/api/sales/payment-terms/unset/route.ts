import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

const isAdmin = (role: string) => role === 'admin' || role === 'executive' || role === 'sales_admin';

// GET /api/sales/payment-terms/unset?manager=XXX
// 결제조건 미설정 거래처(와인+글라스, 신규 포함) — 서버에서 필터해 미설정만 반환(경량). 알림 배너용.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;
    if (!manager) return NextResponse.json({ clients: [] });

    const [w, g] = await Promise.all([
      supabase.rpc('fn_client_payment_terms', { p_manager: manager, p_type: 'wine' }),
      supabase.rpc('fn_client_payment_terms', { p_manager: manager, p_type: 'glass' }),
    ]);
    if (w.error) throw w.error;
    if (g.error) throw g.error;

    type Row = { client_code: string; client_name: string; payment_type: string | null };
    const pick = (rows: Row[] | null, type: 'wine' | 'glass') =>
      (rows || []).filter(r => !r.payment_type).map(r => ({ client_code: r.client_code, client_name: r.client_name, type }));
    const clients = [...pick(w.data, 'wine'), ...pick(g.data, 'glass')];
    return NextResponse.json({ clients });
  } catch (err) {
    console.error('GET /api/sales/payment-terms/unset error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
