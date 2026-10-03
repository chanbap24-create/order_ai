import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/app/lib/cronAuth';
import { notifyArrivals } from '@/app/lib/store/restockAlerts';
import { recordStoreArrivals } from '@/app/lib/store/storeArrivals';
import { handleApiError } from '@/app/lib/errors';

// 매장 입고 알림 — 매일 Vercel Cron. 입고 판정 후 신청 사원에게 텔레그램(연동된 사원만).
// 매장별 입고 기록도 함께(업로드 직후 기록이 빠졌을 때 대비 — 원격 동기화 등).
export async function GET(req: NextRequest) {
  try {
    if (!(await authorizeCron(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const storeArrivals = await recordStoreArrivals().catch(() => null); // 실패해도 알림 발송은 진행
    return NextResponse.json({ ...(await notifyArrivals()), storeArrivals });
  } catch (e) {
    return handleApiError(e);
  }
}
