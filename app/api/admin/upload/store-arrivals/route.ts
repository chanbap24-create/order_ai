import { NextResponse } from 'next/server';
import { recordStoreArrivals } from '@/app/lib/store/storeArrivals';
import { handleApiError } from '@/app/lib/errors';

// 재고(CDV·DL) 업로드 완료 후 매장별 입고 기록
export async function POST() {
  try {
    return NextResponse.json({ runs: await recordStoreArrivals() });
  } catch (e) {
    return handleApiError(e);
  }
}
