import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf, searchView } from '@/app/lib/store/scope';
import { handleApiError } from '@/app/lib/errors';

// 매장 앱 — 재고 검색. 보기 범위(매장 고정/전체)는 세션이 정한다(store 파라미터 무시)
export async function GET(req: NextRequest) {
  try {
    const view = storeViewOf(await getSession());
    if (!view) return NextResponse.json({ error: '매장 앱 권한이 필요합니다.' }, { status: 401 });
    const q = req.nextUrl.searchParams.get('q') || '';
    const kind = req.nextUrl.searchParams.get('kind') === 'glass' ? 'glass' : 'wine';
    return NextResponse.json({ rows: await searchView(q, view, kind) });
  } catch (e) {
    return handleApiError(e);
  }
}
