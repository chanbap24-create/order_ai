import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { proxyImage } from '@/app/lib/imageProxy';

// 병샷/와이너리 로고 프록시 (세일즈 세션) — 프로모션 스타일 견적 이미지(canvas) 저장용 same-origin 이미지.
//   ?code=<품번> → 와인 병샷 / ?brand=<브랜드코드> → 와이너리 로고. 키 조회라 SSRF 없음. 로그인 필요.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const brand = (req.nextUrl.searchParams.get('brand') || '').trim();
  if (brand) {
    if (brand.length > 10) return new NextResponse(null, { status: 400 });
    const { data: b } = await supabase.from('brands').select('logo_url').eq('brand_code', brand.toUpperCase()).maybeSingle();
    return proxyImage(b?.logo_url || '', 'private');
  }

  const code = (req.nextUrl.searchParams.get('code') || '').trim();
  if (!code || code.length > 20) return new NextResponse(null, { status: 400 });

  const { data: w } = await supabase.from('wines').select('image_url').eq('item_code', code).maybeSingle();
  return proxyImage(w?.image_url || '', 'private');
}
