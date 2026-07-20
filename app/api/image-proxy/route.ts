// 이미지 동일출처 프록시 — 캔버스(상세카드 PNG)에서 외부 병 이미지를 오염(CORS) 없이 그리기 위함.
// 허용 호스트(와인 이미지 출처)만 통과. content-type=image, 크기 상한.
import { NextRequest, NextResponse } from 'next/server';

const MAX_BYTES = 8 * 1024 * 1024;

// SSRF 방지: 내부망/사설 IP·로컬 호스트 차단. 그 외 공개 https 이미지는 허용
// (와인 image_url이 여러 CDN에 흩어져 있어 화이트리스트론 계속 누락됨).
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // IPv4 리터럴 사설 대역
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h.startsWith('[')) return true; // IPv6 리터럴 차단(간소화)
  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') || '';
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: 'bad url' }, { status: 400 }); }
  if (u.protocol !== 'https:' || isBlockedHost(u.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 });
  }
  try {
    const res = await fetch(u.toString(), {
      cache: 'no-store',
      // 일부 CDN(klwines 등)은 UA 없으면 content-type을 안 주거나 차단 → 브라우저 UA로 요청
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaveDeVinBot/1.0)' },
    });
    if (!res.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    // 명백한 에러 페이지(html/json/text)만 거부. 비어있거나 image/* 는 통과.
    if (ct.startsWith('text/') || ct.startsWith('application/json') || ct.includes('html')) {
      return NextResponse.json({ error: 'not image' }, { status: 415 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
    // content-type 보정: image/* 이면 그대로, 아니면 확장자로 추정, 그래도 없으면 jpeg
    let outCt = ct.startsWith('image/') ? ct : '';
    if (!outCt) {
      const path = u.pathname.toLowerCase();
      outCt = path.endsWith('.png') ? 'image/png'
        : path.endsWith('.webp') ? 'image/webp'
        : path.endsWith('.gif') ? 'image/gif'
        : 'image/jpeg';
    }
    return new NextResponse(buf, {
      headers: { 'Content-Type': outCt, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 502 });
  }
}
