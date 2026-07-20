// 이미지 동일출처 프록시 — 캔버스(상세카드 PNG)에서 외부 병 이미지를 오염(CORS) 없이 그리기 위함.
// 허용 호스트(와인 이미지 출처)만 통과. content-type=image, 크기 상한.
import { NextRequest, NextResponse } from 'next/server';

const ALLOW_HOSTS = [
  'zxfmlanwrhhdblsibxuw.supabase.co',
  'images.vivino.com',
  'awine.kr',
  'github.com', 'objects.githubusercontent.com',
  'd5d6oog86le2r.cloudfront.net',
];
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') || '';
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: 'bad url' }, { status: 400 }); }
  if (u.protocol !== 'https:' || !ALLOW_HOSTS.includes(u.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 });
  }
  try {
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return NextResponse.json({ error: 'not image' }, { status: 415 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
    return new NextResponse(buf, {
      headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 502 });
  }
}
