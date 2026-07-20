import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';

// 와인 병샷 프록시 (세일즈 세션) — 프로모션 스타일 견적 이미지(canvas) 저장용 same-origin 이미지.
// 품번 키로만 조회(SSRF 없음). 로그인 필요.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const code = (req.nextUrl.searchParams.get('code') || '').trim();
  if (!code || code.length > 20) return new NextResponse(null, { status: 400 });

  const { data: w } = await supabase.from('wines').select('image_url').eq('item_code', code).maybeSingle();
  const url = w?.image_url || '';
  if (!/^https?:\/\//.test(url)) return new NextResponse(null, { status: 404 });

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return new NextResponse(null, { status: 404 });
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return new NextResponse(null, { status: 415 });
    return new NextResponse(await res.arrayBuffer(), {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
