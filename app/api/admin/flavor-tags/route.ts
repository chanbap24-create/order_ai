import { NextResponse } from 'next/server';
import { getFlavorTagsData } from '@/app/lib/flavorTagsData';

// 관리자 향미태그 브라우저 데이터(미들웨어가 admin_auth 강제). 얇게 유지 — 로직은 lib.
export async function GET() {
  try {
    const wines = await getFlavorTagsData();
    return NextResponse.json({ wines });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 });
  }
}
