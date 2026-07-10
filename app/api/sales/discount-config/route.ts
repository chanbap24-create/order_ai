import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getDiscountConfig, saveDiscountConfig } from '@/app/lib/pricing/discountConfig';

// 업태별 할인율 등급조건 조회/저장 — 인증된 세일즈 사용자만.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const corp = req.nextUrl.searchParams.get('corporation') || 'CDV';
    return NextResponse.json({ config: await getDiscountConfig(corp) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const body = await req.json();
    const corp = typeof body.corporation === 'string' ? body.corporation : 'CDV';
    const config = await saveDiscountConfig(corp, body.config);
    return NextResponse.json({ success: true, config });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 400 });
  }
}
