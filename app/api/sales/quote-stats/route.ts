// 견적 발행 → 발주 전환 시계열 — 견적성과 탭용. 로직은 app/lib/quoteStats.
import { NextRequest, NextResponse } from 'next/server';
import { resolveManagerScope } from '@/app/lib/authz';
import { getQuoteStats } from '@/app/lib/quoteStats';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    // 일반 user 는 본인 manager 로 강제(타 담당 성과 열람 방지). 어드민은 ''=전체.
    const scope = await resolveManagerScope(sp.get('manager'));
    if (!scope.ok) return scope.res;

    const type = sp.get('type') === 'glass' ? 'glass' : 'wine';
    const bucket = sp.get('bucket') === 'month' ? 'month' : 'week';
    const months = Math.min(12, Math.max(1, Number(sp.get('months')) || 3));

    const data = await getQuoteStats({ type, manager: scope.manager || undefined, months, bucket });
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '집계 실패' }, { status: 500 });
  }
}
