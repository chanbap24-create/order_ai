import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
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

    const [wine, glass] = await Promise.all([
      supabase.rpc('fn_collection_schedule', { p_manager: manager, p_type: 'wine', p_as_of: asOf }),
      supabase.rpc('fn_collection_schedule', { p_manager: manager, p_type: 'glass', p_as_of: asOf }),
    ]);
    if (wine.error) throw wine.error;
    if (glass.error) throw glass.error;

    const buf = await buildScheduleXlsx(
      (wine.data || []) as ScheduleClient[],
      (glass.data || []) as ScheduleClient[],
      asOf, manager,
    );

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
