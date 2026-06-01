import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

const isAdmin = (role: string) => role === 'admin' || role === 'executive' || role === 'sales_admin';

// GET /api/sales/payment-terms?manager=XXX&type=wine
// 매니저의 거래처 목록 + 현재 결제조건. 저장은 PUT /api/sales/collections 재사용.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clientType = searchParams.get('type') === 'glass' ? 'glass' : 'wine';
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;

    const { data, error } = await supabase.rpc('fn_client_payment_terms', {
      p_manager: manager,
      p_type: clientType,
    });
    if (error) throw error;
    return NextResponse.json({ clients: data || [] });
  } catch (err) {
    console.error('GET /api/sales/payment-terms error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
