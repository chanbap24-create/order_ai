import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { corpOfStore, searchStoreStock } from '@/app/lib/store/stockView';
import { handleApiError } from '@/app/lib/errors';

// 점장 PWA — 매장 재고 검색
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const q = req.nextUrl.searchParams.get('q') || '';
    const corp = corpOfStore(req.nextUrl.searchParams.get('store') || '');
    return NextResponse.json({ rows: await searchStoreStock(q, corp) });
  } catch (e) {
    return handleApiError(e);
  }
}
