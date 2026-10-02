import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/app/lib/cronAuth';
import { notifyArrivals } from '@/app/lib/store/restockAlerts';
import { handleApiError } from '@/app/lib/errors';

// 매장 입고 알림 — 매일 Vercel Cron. 입고 판정 후 신청 사원에게 텔레그램(연동된 사원만).
export async function GET(req: NextRequest) {
  try {
    if (!(await authorizeCron(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json(await notifyArrivals());
  } catch (e) {
    return handleApiError(e);
  }
}
