import { NextRequest, NextResponse } from 'next/server';
import { getPromoImageUrl } from '@/app/lib/promoPage';

// 프로모션 병샷 프록시 (공개) — /promo 페이지의 '이미지로 저장'(canvas)용 same-origin 이미지.
// URL 직접 프록시가 아니라 활성 프로모션 품번으로만 조회(SSRF 방지).
export async function GET(req: NextRequest) {
  const item = (req.nextUrl.searchParams.get('item') || '').trim();
  if (!item || item.length > 20) return new NextResponse(null, { status: 400 });

  const url = await getPromoImageUrl(item);
  if (!url) return new NextResponse(null, { status: 404 });

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return new NextResponse(null, { status: 404 });
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return new NextResponse(null, { status: 415 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
