import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { storeViewOf } from '@/app/lib/store/scope';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // 세션에 부서 정보 없으면 DB에서 보충
    let department = session.department || '';
    if (!department) {
      const { data } = await supabase
        .from('sales_users')
        .select('department')
        .eq('manager', session.manager)
        .maybeSingle();
      department = data?.department || '';
    }

    return NextResponse.json({
      authenticated: true,
      manager: session.manager,
      role: session.role,
      department,
      store: session.store, // 매장 앱 접근 권한
      // 매장 앱 보기 범위 — 매장 직원=자기 매장 고정, 본사='all'(전체 매장·조회 전용, 판매 불가)
      storeView: storeViewOf(session),
      canSell: (() => { const v = storeViewOf(session); return !!v && v !== 'all'; })(),
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
