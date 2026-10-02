import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf, summaryView } from '@/app/lib/store/scope';
import { handleApiError } from '@/app/lib/errors';

// 매장 앱 — 홈 요약(매장 보유 품목수·입고 예정·금주 입고). 보기 범위는 세션 기준
export async function GET() {
  try {
    const view = storeViewOf(await getSession());
    if (!view) return NextResponse.json({ error: '매장 앱 권한이 필요합니다.' }, { status: 401 });
    return NextResponse.json(await summaryView(view));
  } catch (e) {
    return handleApiError(e);
  }
}
