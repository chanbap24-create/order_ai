// 외부 병샷 프록시 공용 로직 — same-origin 이미지 제공(canvas taint 방지).
// 일부 CDN(klwines 등)은 content-type 헤더 없이 이미지를 주므로, 헤더가 없거나
// 이미지가 아니면 매직 넘버로 실제 타입을 판별한다. HTML(에러 페이지)만 거른다.
import { NextResponse } from 'next/server';

function sniffImageType(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  // WEBP: "RIFF"...."WEBP"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/** 외부 이미지 URL을 받아 same-origin 응답으로 프록시. cacheScope='public'|'private'. */
export async function proxyImage(url: string, cacheScope: 'public' | 'private'): Promise<NextResponse> {
  if (!/^https?:\/\//.test(url)) return new NextResponse(null, { status: 404 });
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return new NextResponse(null, { status: 404 });
    const buf = await res.arrayBuffer();
    const header = (res.headers.get('content-type') || '').toLowerCase();

    let type = header.startsWith('image/') ? header : sniffImageType(buf);
    // 헤더가 image가 아니고 매직도 못 잡았는데 HTML이면 에러 페이지 → 거절
    if (!type) {
      if (header.includes('text/html')) return new NextResponse(null, { status: 415 });
      type = sniffImageType(buf) || 'image/jpeg'; // 마지막 폴백(확장자로 온 것 등)
    }
    return new NextResponse(buf, {
      headers: { 'Content-Type': type, 'Cache-Control': `${cacheScope}, max-age=3600` },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
