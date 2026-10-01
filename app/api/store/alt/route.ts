import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { alternatives, STORES, type StoreKey } from '@/app/lib/store/stockView';
import { handleApiError } from '@/app/lib/errors';

// 점장 PWA — 품절/부족 시 대체품 (임베딩 유사도 기반, 재고 있는 것만)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const item = req.nextUrl.searchParams.get('item') || '';
    const store = req.nextUrl.searchParams.get('store') as StoreKey;
    if (!item || !STORES.some((s) => s.key === store)) {
      return NextResponse.json({ error: '파라미터가 필요합니다.' }, { status: 400 });
    }
    return NextResponse.json({ rows: await alternatives(item, store) });
  } catch (e) {
    return handleApiError(e);
  }
}
