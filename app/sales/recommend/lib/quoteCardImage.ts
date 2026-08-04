// 견적 '상세페이지' 이미지 — /promo 프로모션 상세페이지와 동일한 세로 중앙정렬 디자인을 캔버스로 재현.
// (병 사진 위 중앙 · 이름/산지/향미칩/가격 모두 가운데). 카톡 전송용, 배치에서도 동작.
import { roundTo100 } from '@/app/lib/priceUtils';

export interface CardItem {
  name: string;         // 국문명(약어 제거해 전달)
  nameEn?: string | null;
  brandKr?: string | null;
  country?: string | null;
  region?: string | null;
  vintage?: string | null;
  grape?: string | null;
  supply: number;       // 정상 공급가
  rate: number;         // 0~1
  qty?: number | null;
  note?: string | null;
  imageUrl?: string | null;
  flavors?: string[];   // 향미 키워드(한글 라벨)
  story?: string | null; // 테이스팅 스토리(맛 노트) — 선택 시 카드에 문단으로
}

const RED = '#b23b1c';
const INK = '#111';
const SUB = '#6b7280';
const MUTE = '#9ca3af';
const CHIPTX = '#6b7280';
const LINE = '#ebebeb';

const F = (px: number, w: 400 | 600 | 700 | 800 = 400) =>
  `${w} ${px}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const won = (n: number) => n.toLocaleString('ko-KR');
const stripPrefix = (s: string) => (s || '').replace(/^[A-Za-z]{2}\s+/, '').trim();
const shortRegion = (r?: string | null) => {
  if (!r) return '';
  const f = r.split(/[,–—-]/).map((x) => x.trim()).filter(Boolean)[0] || r;
  return f.length > 26 ? f.slice(0, 26) : f;
};
const proxied = (u?: string | null) => (u ? `/api/image-proxy?url=${encodeURIComponent(u)}` : '');

/** 캔버스 폭 기준 줄바꿈 — 최대 줄 수 초과 시 말줄임 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width <= maxW) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && (cur || words.length)) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines.slice(0, maxLines);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadImg(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    const obj = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { URL.revokeObjectURL(obj); resolve(null); };
      img.src = obj;
    });
  } catch { return null; }
}

const IMG_H = 224;      // 병샷 영역 높이(/promo 230)
const PAD_X = 24;
const CARD_PAD_TOP = 28;
const CARD_PAD_BOT = 28;

/** 상세페이지 PNG 생성 — /promo와 동일한 세로 중앙정렬 카드 */
export async function renderQuoteCardImage(opts: {
  clientName: string;
  date: string;
  items: CardItem[];
  logoUrl?: string;
}): Promise<Blob> {
  const items = opts.items;
  const W = 480;

  const bottles = await Promise.all(
    items.map((it) => (it.imageUrl ? loadImg(proxied(it.imageUrl)) : Promise.resolve(null))),
  );

  // 스토리 줄 수 사전 계산용 측정 캔버스
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = F(12);
  const STORY_MAXW = W - PAD_X * 2 - 16;
  const STORY_LINE_H = 18;
  const storyLines = items.map((it) =>
    it.story ? wrapLines(measure, it.story, STORY_MAXW, 4) : []);

  // 카드별 높이 사전 계산(중앙 레이아웃)
  const cardH = items.map((it, i) => {
    let h = CARD_PAD_TOP + IMG_H + 18 + 26; // 병샷 + gap + 이름
    if (it.nameEn) h += 17;
    if (it.country || it.region) h += 20;
    if ((it.flavors || []).filter(Boolean).length) h += 26;
    if (storyLines[i].length) h += 14 + storyLines[i].length * STORY_LINE_H;
    h += 22 + 30; // gap + 가격
    if (it.qty || it.note) h += 20;
    h += CARD_PAD_BOT;
    return h;
  });

  const HERO = 132;
  const FOOTER = 118;
  const H = HERO + cardH.reduce((a, b) => a + b, 0) + FOOTER;

  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;

  // ── 히어로 ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a8a8a';
  ctx.font = F(12, 600);
  // 자간(letter-spacing) 흉내: 글자 사이 공백
  ctx.fillText('C A V E   D E   V I N', cx, 46);
  ctx.fillStyle = INK; ctx.font = F(27, 700);
  ctx.fillText('와인 제안', cx, 84);
  ctx.fillStyle = SUB; ctx.font = F(14);
  ctx.fillText(`${opts.clientName} 귀하 · ${opts.date} · ${items.length}종`, cx, 110);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HERO); ctx.lineTo(W, HERO); ctx.stroke();

  // ── 카드 ──
  let y = HERO;
  items.forEach((it, i) => {
    const ch = cardH[i];
    const disc = roundTo100(it.supply * (1 - it.rate));
    const rate = it.rate > 0 ? Math.round(it.rate * 100) : 0;

    // 병샷(중앙, 상단)
    let iy = y + CARD_PAD_TOP;
    const img = bottles[i];
    if (img) {
      const maxW = W * 0.62, maxH = IMG_H;
      const r = Math.min(maxW / img.width, maxH / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, cx - dw / 2, iy + (IMG_H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#f3f3f3'; ctx.font = '40px serif'; ctx.textAlign = 'center';
      ctx.fillText('🍷', cx, iy + IMG_H / 2 + 14);
    }
    iy += IMG_H + 18 + 20;

    // 이름(국문)
    ctx.textAlign = 'center';
    ctx.fillStyle = INK; ctx.font = F(17.5, 700);
    let nm = stripPrefix(it.name);
    const maxNameW = W - PAD_X * 2;
    if (ctx.measureText(nm).width > maxNameW) { while (nm.length > 4 && ctx.measureText(nm + '…').width > maxNameW) nm = nm.slice(0, -1); nm += '…'; }
    ctx.fillText(nm, cx, iy); iy += 6;
    // 영문명
    if (it.nameEn) {
      iy += 14; ctx.fillStyle = MUTE; ctx.font = F(11.5);
      let en = it.nameEn;
      if (ctx.measureText(en).width > maxNameW) { while (en.length > 4 && ctx.measureText(en + '…').width > maxNameW) en = en.slice(0, -1); en += '…'; }
      ctx.fillText(en, cx, iy); iy -= 14;
    }
    iy += (it.nameEn ? 17 : 3);
    // 산지
    if (it.country || it.region) {
      iy += 16; ctx.fillStyle = SUB; ctx.font = F(12);
      ctx.fillText([it.country, shortRegion(it.region), it.vintage].filter(Boolean).join(' · '), cx, iy); iy += 4;
    }
    // 향미 칩(중앙, 아웃라인 필)
    const flavors = (it.flavors || []).filter(Boolean).slice(0, 5);
    if (flavors.length) {
      iy += 22;
      ctx.font = F(11, 400);
      const gap = 5, padX = 9;
      const widths = flavors.map((f) => ctx.measureText(f).width + padX * 2);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (flavors.length - 1);
      let chx = cx - total / 2;
      for (let k = 0; k < flavors.length; k++) {
        const wpx = widths[k];
        ctx.strokeStyle = LINE; ctx.lineWidth = 1;
        roundRectPath(ctx, chx, iy - 13, wpx, 20, 10); ctx.stroke();
        ctx.fillStyle = CHIPTX; ctx.textAlign = 'center';
        ctx.fillText(flavors[k], chx + wpx / 2, iy + 1);
        chx += wpx + gap;
      }
      iy += 4;
    }

    // 테이스팅 스토리(맛 노트) — 중앙 문단
    if (storyLines[i].length) {
      iy += 14;
      ctx.fillStyle = SUB; ctx.font = F(12); ctx.textAlign = 'center';
      for (const ln of storyLines[i]) { iy += STORY_LINE_H; ctx.fillText(ln, cx, iy); }
      iy -= 4;
    }

    // 가격(중앙, baseline 정렬): 정상가(취소선) + 할인가(큰 빨강) + N%↓
    iy += 24;
    ctx.textAlign = 'center';
    const parts: Array<{ t: string; f: string; c: string; strike?: boolean }> = [];
    if (rate > 0 && it.supply > it.supply * (1 - it.rate)) parts.push({ t: `${won(it.supply)}원`, f: F(13.5), c: MUTE, strike: true });
    parts.push({ t: `${won(disc)}원`, f: F(23, 700), c: RED });
    if (rate > 0) parts.push({ t: `${rate}%↓`, f: F(12.5, 700), c: RED });
    // 폭 합산 후 중앙 배치
    const gap = 10;
    const ws = parts.map((p) => { ctx.font = p.f; return ctx.measureText(p.t).width; });
    const totalW = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    let px = cx - totalW / 2;
    ctx.textAlign = 'left';
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      ctx.font = p.f; ctx.fillStyle = p.c;
      ctx.fillText(p.t, px, iy);
      if (p.strike) { ctx.strokeStyle = MUTE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, iy - 5); ctx.lineTo(px + ws[k], iy - 5); ctx.stroke(); }
      px += ws[k] + gap;
    }
    // 수량·비고
    if (it.qty || it.note) {
      iy += 20; ctx.textAlign = 'center'; ctx.fillStyle = SUB; ctx.font = F(12);
      ctx.fillText([it.qty ? `${it.qty}병 구성` : '', it.note].filter(Boolean).join(' · '), cx, iy);
    }

    // 구분선
    if (i < items.length - 1) {
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD_X, y + ch); ctx.lineTo(W - PAD_X, y + ch); ctx.stroke();
    }
    y += ch;
  });

  // ── 푸터 ──
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = F(12.5, 700);
  ctx.fillText('(주) 까 브 드 뱅', cx, y + 34);
  ctx.fillStyle = '#8a8a8a'; ctx.font = F(11.5);
  ctx.fillText('주문·문의는 담당 영업사원에게 · TEL 02-786-3136', cx, y + 56);
  ctx.fillText('가격은 공급가(VAT 별도) 기준 · 재고 소진 시 조기 마감', cx, y + 76);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 생성 실패'))), 'image/png');
  });
}
