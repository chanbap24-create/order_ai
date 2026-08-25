import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { fetchAllRows } from '@/app/lib/fetchAll';

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

    type Row = { client_code: string; client_name: string; payment_type: string | null };
    // SETOF RPC 1000행 캡 — 페이지네이션 (1000곳 초과 담당자의 거래처 누락 방지)
    const [w, g] = await Promise.all([
      fetchAllRows<Row>((f, t) => supabase.rpc('fn_client_payment_terms', { p_manager: manager, p_type: 'wine' }).range(f, t)),
      fetchAllRows<Row>((f, t) => supabase.rpc('fn_client_payment_terms', { p_manager: manager, p_type: 'glass' }).range(f, t)),
    ]);

    const pick = (rows: Row[], type: 'wine' | 'glass') =>
      rows.filter(r => !r.payment_type).map(r => ({ client_code: r.client_code, client_name: r.client_name, type }));
    const clients = [...pick(w, 'wine'), ...pick(g, 'glass')];
    return NextResponse.json({ clients });
  } catch (err) {
    console.error('GET /api/sales/payment-terms/unset error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
