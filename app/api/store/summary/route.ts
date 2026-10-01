import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { storeSummary, STORES, type StoreKey } from '@/app/lib/store/stockView';
import { handleApiError } from '@/app/lib/errors';

// 점장 PWA — 홈 요약 (우리 매장 품목수·들어오는 중·최근 입항)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const store = req.nextUrl.searchParams.get('store') as StoreKey;
    if (!STORES.some((s) => s.key === store)) {
      return NextResponse.json({ error: '매장을 선택하세요.' }, { status: 400 });
    }
    return NextResponse.json(await storeSummary(store));
  } catch (e) {
    return handleApiError(e);
  }
}
