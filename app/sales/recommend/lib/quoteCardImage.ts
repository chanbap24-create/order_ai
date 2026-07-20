// 견적 '상세카드' 이미지 렌더러 — 병 사진·큰 할인가가 있는 세로형 카드(카톡 전송용).
// /promo 상세페이지 톤을 캔버스로 재현. renderQuoteImage(견적표)와 선택 가능한 대안 스타일.
import { roundTo100 } from '@/app/lib/priceUtils';

export interface CardItem {
  name: string;
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
}

const WINE = '#7b1f24';
const RED = '#b23b1c';
const INK = '#111';
const SUB = '#6b7280';
const MUTE = '#9ca3af';
const LINE = '#ebebeb';

const F = (px: number, w: 400 | 600 | 700 | 800 = 400) =>
  `${w} ${px}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const won = (n: number) => n.toLocaleString();
const stripPrefix = (s: string) => (s || '').replace(/^[A-Za-z]{2}\s+/, '').trim();
const shortRegion = (r?: string | null) => {
  if (!r) return '';
  const f = r.split(/[,–—-]/).map((x) => x.trim()).filter(Boolean)[0] || r;
  return f.length > 24 ? f.slice(0, 24) : f;
};
const proxied = (u?: string | null) => (u ? `/api/image-proxy?url=${encodeURIComponent(u)}` : '');

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 상세카드 견적 PNG 생성 (세로형, 480 논리폭 · 2배 렌더) */
export async function renderQuoteCardImage(opts: {
  clientName: string;
  date: string;        // YYYY-MM-DD
  items: CardItem[];
  logoUrl?: string;
}): Promise<Blob> {
  const items = opts.items;
  const W = 520;
  const HEADER = 150;
  const CARD_H = 176;
  const FOOTER = 116;
  const H = HEADER + items.length * CARD_H + FOOTER;

  const [logo, ...bottles] = await Promise.all([
    opts.logoUrl ? loadImg(opts.logoUrl) : Promise.resolve(null),
    ...items.map((it) => (it.imageUrl ? loadImg(proxied(it.imageUrl)) : Promise.resolve(null))),
  ]);

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // ── 헤더 ──
  if (logo) {
    const lw = 168, lh = lw * (logo.height / logo.width);
    ctx.drawImage(logo, (W - lw) / 2, 24, lw, lh);
  } else {
    ctx.fillStyle = WINE; ctx.font = '700 26px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('CAVE DE VIN', W / 2, 52);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = F(22, 700);
  ctx.fillText('와인 제안', W / 2, HEADER - 46);
  ctx.fillStyle = SUB; ctx.font = F(13.5);
  ctx.fillText(`${opts.clientName} 귀하 · ${opts.date} · ${items.length}종`, W / 2, HEADER - 22);
  ctx.strokeStyle = LINE;
  ctx.beginPath(); ctx.moveTo(24, HEADER); ctx.lineTo(W - 24, HEADER); ctx.stroke();

  // ── 카드 ──
  let y = HEADER;
  const imgW = 150;
  items.forEach((it, i) => {
    const disc = roundTo100(it.supply * (1 - it.rate));
    const rate = it.rate > 0 ? Math.round(it.rate * 100) : 0;

    // 병 이미지(좌)
    const img = bottles[i];
    if (img) {
      const pad = 18;
      const aw = imgW - pad * 2, ah = CARD_H - pad * 2;
      const r = Math.min(aw / img.width, ah / img.height);
      ctx.drawImage(img, 24 + pad + (aw - img.width * r) / 2, y + pad + (ah - img.height * r) / 2, img.width * r, img.height * r);
    }

    const tx = 24 + imgW + 8;
    const rightX = W - 28;
    ctx.textAlign = 'left';
    let ty = y + 40;
    if (it.brandKr) { ctx.fillStyle = MUTE; ctx.font = F(12.5, 700); ctx.fillText(it.brandKr, tx, ty); ty += 22; }
    else ty += 2;
    ctx.fillStyle = INK; ctx.font = F(18, 700);
    let nm = stripPrefix(it.name);
    const maxW = rightX - tx;
    if (ctx.measureText(nm).width > maxW) { while (nm.length > 4 && ctx.measureText(nm + '…').width > maxW) nm = nm.slice(0, -1); nm += '…'; }
    ctx.fillText(nm, tx, ty); ty += 24;
    ctx.fillStyle = SUB; ctx.font = F(13);
    const meta = [it.country, shortRegion(it.region), it.vintage].filter(Boolean).join(' · ');
    ctx.fillText(meta, tx, ty); ty += 20;
    if (it.grape) { ctx.fillStyle = MUTE; ctx.font = F(12); ctx.fillText(shortRegion(it.grape), tx, ty); }

    // 가격(우측 하단)
    ctx.textAlign = 'right';
    if (rate > 0 && it.supply > 0) {
      ctx.fillStyle = MUTE; ctx.font = F(13);
      const t = `${won(it.supply)}원`;
      ctx.fillText(t, rightX, y + CARD_H - 44);
      const w = ctx.measureText(t).width;
      ctx.strokeStyle = MUTE; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(rightX - w, y + CARD_H - 48); ctx.lineTo(rightX, y + CARD_H - 48); ctx.stroke();
    }
    ctx.fillStyle = RED; ctx.font = F(25, 800);
    ctx.fillText(`${won(disc)}원`, rightX, y + CARD_H - 18);
    if (rate > 0) {
      ctx.font = F(12.5, 700);
      const rt = `${rate}%↓`;
      ctx.fillText(rt, rightX, y + CARD_H - 44 + (it.supply > 0 ? 0 : 0));
    }
    // 수량/비고
    ctx.textAlign = 'left';
    const tail = [it.qty ? `추천 ${it.qty}병` : '', it.note || ''].filter(Boolean).join(' · ');
    if (tail) { ctx.fillStyle = MUTE; ctx.font = F(11.5); ctx.fillText(tail, tx, y + CARD_H - 18); }

    ctx.strokeStyle = LINE;
    ctx.beginPath(); ctx.moveTo(24, y + CARD_H); ctx.lineTo(W - 24, y + CARD_H); ctx.stroke();
    y += CARD_H;
  });

  // ── 푸터 ──
  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = F(13, 700);
  ctx.fillText('(주) 까브드뱅', W / 2, y + 38);
  ctx.fillStyle = MUTE; ctx.font = F(11.5);
  ctx.fillText('주문·문의는 담당 영업사원에게 · TEL 02-786-3136', W / 2, y + 60);
  ctx.fillText('※ VAT 별도 · 공급가 기준 · 재고 소진 시 조기 마감', W / 2, y + 80);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 생성 실패'))), 'image/png');
  });
}
