import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/app/lib/cronAuth';
import { purgeInactiveSommelierCustomers } from '@/app/lib/sommelierDb';
import { handleApiError } from '@/app/lib/errors';

// 소믈리에 고객 개인정보 보유기간(마지막 방문 3년) 파기 — 매일 Vercel Cron. ?dry=1 미리보기.
export async function GET(req: NextRequest) {
  try {
    if (!(await authorizeCron(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const dry = req.nextUrl.searchParams.get('dry') === '1';
    const purged = await purgeInactiveSommelierCustomers(dry);
    return NextResponse.json({ dry, purged });
  } catch (e) {
    return handleApiError(e);
  }
}
