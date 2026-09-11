// 병샷 정규화 — 배경 여백을 잘라 병 높이를 통일(소믈리에 카드 상하단 정렬용).
// 배경이 순백이 아니라 옅은 그라데이션인 병샷이 많아 흰색 trim이 안 먹으므로,
// 밝기 스캔으로 병 bounding box를 직접 찾아 crop한 뒤 고정 캔버스(600x800)에 contain.
// 원본 해상도가 표시보다 훨씬 커서 전부 축소 → 화질 손실 없음.
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { proxyImage } from './imageProxy';

/** 밝기<TH 인 픽셀이 병. 90px로 축소해 스캔(가벼움). 전부 배경이면 null. */
async function bottleBox(buf: Buffer, TH = 232) {
  const { data, info } = await sharp(buf)
    .flatten({ background: '#ffffff' })
    .resize(90)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const rows = new Array(H).fill(false);
  const cols = new Array(W).fill(false);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] < TH) { rows[y] = true; cols[x] = true; }
    }
  }
  const ri = rows.indexOf(true), rl = rows.lastIndexOf(true);
  const ci = cols.indexOf(true), cl = cols.lastIndexOf(true);
  if (ri < 0 || ci < 0) return null;
  return { top: ri / H, bottom: (rl + 1) / H, left: ci / W, right: (cl + 1) / W };
}

/** 병 bbox를 잘라 600x800 흰 캔버스에 중앙 contain. bbox 실패 시 원본을 그대로 정규화. */
export async function normalizeBottle(buf: Buffer): Promise<Buffer> {
  const [box, meta] = await Promise.all([bottleBox(buf), sharp(buf).metadata()]);
  const W = meta.width || 0, H = meta.height || 0;
  const base = sharp(buf).flatten({ background: '#ffffff' });
  if (!box || !W || !H) {
    return base.resize(600, 800, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
  }
  const pad = 0.02; // 병이 잘리지 않게 소폭 여유
  const l = Math.max(0, Math.round((box.left - pad) * W));
  const t = Math.max(0, Math.round((box.top - pad) * H));
  const r = Math.min(W, Math.round((box.right + pad) * W));
  const b = Math.min(H, Math.round((box.bottom + pad) * H));
  return base
    .extract({ left: l, top: t, width: Math.max(1, r - l), height: Math.max(1, b - t) })
    .resize(600, 800, { fit: 'contain', background: '#ffffff', position: 'center' })
    .png()
    .toBuffer();
}

/** URL(외부 http/data:)의 병샷을 정규화해 same-origin PNG로 응답. 실패 시 원본 프록시 폴백. */
export async function bottleImageResponse(url: string): Promise<NextResponse> {
  try {
    let buf: Buffer;
    const dm = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(url);
    if (dm) {
      buf = Buffer.from(dm[1], 'base64');
    } else if (/^https?:\/\//.test(url)) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return new NextResponse(null, { status: 404 });
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      return new NextResponse(null, { status: 404 });
    }
    const out = await normalizeBottle(buf);
    return new NextResponse(out, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return proxyImage(url, 'private'); // 정규화 실패 시 원본 그대로
  }
}
