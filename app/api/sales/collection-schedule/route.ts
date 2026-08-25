import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { fetchAllRows } from '@/app/lib/fetchAll';
import { buildScheduleXlsx } from '@/app/lib/collection-schedule/buildXlsx';
import type { ScheduleClient } from '@/app/lib/collection-schedule/compute';

const isAdmin = (r: string) => r === 'admin' || r === 'executive' || r === 'sales_admin';

// GET /api/sales/collection-schedule?manager=XXX&as_of=YYYY-MM-DD → 수금일정표 xlsx (CD+DL)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manager = isAdmin(session.role) ? (searchParams.get('manager') || session.manager) : session.manager;
    const asOf = searchParams.get('as_of') || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

    // SETOF RPC 1000행 캡 — 페이지네이션 (거래처 1000곳 초과 담당자의 일정표 행 누락 방지)
    const [wine, glass] = await Promise.all([
      fetchAllRows<ScheduleClient>((f, t) => supabase.rpc('fn_collection_schedule', { p_manager: manager, p_type: 'wine', p_as_of: asOf }).range(f, t)),
      fetchAllRows<ScheduleClient>((f, t) => supabase.rpc('fn_collection_schedule', { p_manager: manager, p_type: 'glass', p_as_of: asOf }).range(f, t)),
    ]);

    const buf = await buildScheduleXlsx(wine, glass, asOf, manager);

    const fname = `수금일정표_영업1부 ${manager}_${asOf.replace(/-/g, '').slice(2)}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
      },
    });
  } catch (err) {
    console.error('GET /api/sales/collection-schedule error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
