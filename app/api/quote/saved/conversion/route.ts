import { NextRequest, NextResponse } from 'next/server';
import { getQuoteConversion, getClientConversion } from '@/app/lib/quoteConversion';

// GET ?id=        → 단일 견적의 항목별 출고 전환
// GET ?client_code= → 거래처 전체(와인별) 전환 합산 (다음 견적 참고용)
// 선택: ?days= 전환 인정 기간(기본 60, 1~365)
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const days = Math.min(365, Math.max(1, Number(sp.get('days')) || 60));
    const id = sp.get('id');
    const clientCode = sp.get('client_code');
    const typeParam = sp.get('type');
    const type = typeParam === 'glass' ? 'glass' : typeParam === 'wine' ? 'wine' : undefined;

    if (id) {
      const data = await getQuoteConversion(Number(id), days);
      return NextResponse.json({ success: true, ...data });
    }
    if (clientCode) {
      const data = await getClientConversion(clientCode, days, type);
      return NextResponse.json({ success: true, ...data });
    }
    return NextResponse.json({ error: 'id 또는 client_code가 필요합니다.' }, { status: 400 });
  } catch (e) {
    console.error('Quote conversion error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '전환 계산 실패' }, { status: 500 });
  }
}
