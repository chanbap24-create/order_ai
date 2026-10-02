import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf, altView } from '@/app/lib/store/scope';
import { handleApiError } from '@/app/lib/errors';

// 매장 앱 — 품절/부족 시 대체품(임베딩 유사도, 재고 있는 것만). 보기 범위는 세션 기준
export async function GET(req: NextRequest) {
  try {
    const view = storeViewOf(await getSession());
    if (!view) return NextResponse.json({ error: '매장 앱 권한이 필요합니다.' }, { status: 401 });
    const item = req.nextUrl.searchParams.get('item') || '';
    if (!item) return NextResponse.json({ error: '품목이 필요합니다.' }, { status: 400 });
    return NextResponse.json({ rows: await altView(item, view) });
  } catch (e) {
    return handleApiError(e);
  }
}
