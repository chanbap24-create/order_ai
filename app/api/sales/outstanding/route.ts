import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { resolveManagerScope } from '@/app/lib/authz';

// GET /api/sales/outstanding?manager=XXX&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&type=wine
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // 일반 user 는 본인 manager 로 강제 (타 매니저 미수 조회 방지)
    const scope = await resolveManagerScope(searchParams.get('manager'));
    if (!scope.ok) return scope.res;
    const manager = scope.manager || scope.session.manager;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const clientType = searchParams.get('type') || 'wine';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date, end_date required' }, { status: 400 });
    }

    const rpcName = clientType === 'glass' ? 'calc_glass_outstanding_v2' : 'calc_wine_outstanding';
    const { data, error } = await supabase.rpc(rpcName, {
      p_manager: manager,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) throw error;
    return NextResponse.json({ clients: data || [] });
  } catch (err) {
    console.error('GET /api/sales/outstanding error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
