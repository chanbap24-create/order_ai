import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';

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
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
