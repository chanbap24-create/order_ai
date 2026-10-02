import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeViewOf, listView } from '@/app/lib/store/scope';
import { handleApiError } from '@/app/lib/errors';

// 매장 앱 — 메뉴 목록: 매장 재고 / 입고 예정. 보기 범위는 세션 기준
export async function GET(req: NextRequest) {
  try {
    const view = storeViewOf(await getSession());
    if (!view) return NextResponse.json({ error: '매장 앱 권한이 필요합니다.' }, { status: 401 });
    const mode = req.nextUrl.searchParams.get('mode') === 'incoming' ? 'incoming' : 'mine';
    const kind = req.nextUrl.searchParams.get('kind') === 'glass' ? 'glass' : 'wine';
    return NextResponse.json({ rows: await listView(view, mode, kind) });
  } catch (e) {
    return handleApiError(e);
  }
}
