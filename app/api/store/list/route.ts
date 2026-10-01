import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { listStoreStock, type StoreKey } from '@/app/lib/store/stockView';
import { handleApiError } from '@/app/lib/errors';

// 점장 PWA — 요약 박스 탭: 우리 매장 보유/입고 예정 전체 리스트
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const store = (req.nextUrl.searchParams.get('store') || '') as StoreKey;
    const mode = req.nextUrl.searchParams.get('mode') === 'incoming' ? 'incoming' : 'mine';
    if (!store) return NextResponse.json({ error: 'store가 필요합니다.' }, { status: 400 });
    return NextResponse.json({ rows: await listStoreStock(store, mode) });
  } catch (e) {
    return handleApiError(e);
  }
}
