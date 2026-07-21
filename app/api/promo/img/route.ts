import { NextRequest, NextResponse } from 'next/server';
import { getPromoImageUrl } from '@/app/lib/promoPage';
import { proxyImage } from '@/app/lib/imageProxy';

// 프로모션 병샷 프록시 (공개) — /promo 페이지의 '이미지로 저장'(canvas)용 same-origin 이미지.
// URL 직접 프록시가 아니라 활성 프로모션 품번으로만 조회(SSRF 방지).
export async function GET(req: NextRequest) {
  const item = (req.nextUrl.searchParams.get('item') || '').trim();
  if (!item || item.length > 20) return new NextResponse(null, { status: 400 });

  const url = await getPromoImageUrl(item);
  if (!url) return new NextResponse(null, { status: 404 });
  return proxyImage(url, 'public');
}
