// 견적서 PNG 렌더러 — 카톡 전송용. 캔버스로 견적서 양식(수신/표/합계)을 그려 이미지로.
// 엑셀 파일을 못/안 여는 거래처에게 채팅방에서 바로 보이는 이미지를 보낼 수 있게.
import { roundTo100 } from '@/app/lib/priceUtils';

export interface QuoteImageItem {
  name: string;
  country?: string;
  vintage?: string;   // 표기용('2022'|'NV'…). 없으면 빈칸
  supply: number;     // 공급가
  rate: number;       // 할인율 0~1
  qty: number;
  note?: string;
}

/** 품번 3~4자리 → 빈티지 표기('2022'|'NV'|''). extractVintage와 동일 규칙(클라이언트용). */
export function vintageFromCode(code: string | undefined | null): string {
  if (!code || code.length < 4) return '';
  const v = code.slice(2, 4).toUpperCase();
  if (v === 'NV' || v === 'MV') return v;
  if (!/^\d{2}$/.test(v)) return '';
  return Number(v) >= 50 ? `19${v}` : `20${v}`;
}

const W = 1240;                 // 논리 너비(픽셀×2 렌더로 선명하게)
const M = 48;                   // 좌우 여백
const HEAD_BG = '#3b2a26';      // 표 헤더(견적서 엑셀과 유사한 딥브라운)
const ZEBRA = '#f7f4f1';
const RED = '#c0392b';
const INK = '#1a1a1a';
const SUB = '#666';

const F = (px: number, w: 400 | 600 | 700 | 800 = 400) =>
  `${w} ${px}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const won = (n: number) => n.toLocaleString();

// 컬럼: [라벨, 폭, 정렬]
const COLS: Array<[string, number, 'left' | 'center' | 'right']> = [
  ['No', 44, 'center'],
  ['국가', 84, 'center'],
  ['상품명', 430, 'left'],
  ['빈티지', 72, 'center'],
  ['공급가', 108, 'right'],
  ['할인율', 66, 'center'],
  ['할인가', 108, 'right'],
  ['수량', 56, 'right'],
  ['합계', 130, 'right'],
];

function wrap2(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  let cut = text.length;
  while (cut > 1 && ctx.measureText(text.slice(0, cut)).width > maxW) cut--;
  const rest = text.slice(cut);
  let cut2 = rest.length;
  while (cut2 > 1 && ctx.measureText(rest.slice(0, cut2) + '…').width > maxW) cut2--;
  return [text.slice(0, cut), cut2 < rest.length ? rest.slice(0, cut2) + '…' : rest];
}

/** 견적서 PNG Blob 생성 */
export async function renderQuoteImage(opts: {
  clientName: string;
  date: string;          // YYYY-MM-DD
  items: QuoteImageItem[];
  senderName?: string;   // 기본 (주)까브드뱅
}): Promise<Blob> {
  const items = opts.items;
  const canvas = document.createElement('canvas');
  const probe = canvas.getContext('2d')!;

  // 행 높이 사전 계산(상품명 2줄 래핑)
  probe.font = F(19);
  const nameW = COLS[2][1] - 20;
  const lines = items.map((it) => wrap2(probe, it.name || '', nameW));
  const rowHs = lines.map((l) => (l.length > 1 ? 62 : 46));

  const headerH = 208;             // 브랜드+수신/발신/제목
  const thH = 48;                  // 표 헤더
  const sumH = 52;                 // 합계 행
  const footH = 96;
  const H = headerH + thH + rowHs.reduce((a, b) => a + b, 0) + sumH + footH;

  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 배경
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // ── 상단: 브랜드 + 문서 정보 ──
  ctx.fillStyle = '#7b1f24';
  ctx.font = '700 34px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAVE DE VIN', W / 2, 56);
  ctx.fillStyle = SUB;
  ctx.font = F(13);
  ctx.fillText('서울특별시 영등포구 여의나루로 71, 809호 · TEL 02-786-3136 · www.cavedevin.com', W / 2, 82);

  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = F(19, 700);
  ctx.fillText(`수신 : ${opts.clientName}`, M, 128);
  ctx.font = F(17);
  ctx.fillText(`발신 : ${opts.senderName || '(주)까브드뱅'}`, M, 156);
  ctx.font = F(19, 700);
  ctx.fillText('제목 : 와인 견적의 건', M, 186);
  ctx.textAlign = 'right';
  ctx.font = F(16);
  ctx.fillStyle = SUB;
  ctx.fillText(opts.date, W - M, 128);
  ctx.fillText('단위: VAT별도, WON, BTL', W - M, 186);

  // ── 표 헤더 ──
  let y = headerH;
  ctx.fillStyle = HEAD_BG;
  ctx.fillRect(M, y, W - M * 2, thH);
  ctx.fillStyle = '#fff';
  ctx.font = F(16, 700);
  let x = M;
  for (const [label, w, align] of COLS) {
    ctx.textAlign = align;
    const tx = align === 'left' ? x + 10 : align === 'right' ? x + w - 10 : x + w / 2;
    ctx.fillText(label, tx, y + 31);
    x += w;
  }
  y += thH;

  // ── 데이터 행 ──
  let totQty = 0, totNormal = 0, totDisc = 0;
  items.forEach((it, i) => {
    const rh = rowHs[i];
    if (i % 2 === 1) {
      ctx.fillStyle = ZEBRA;
      ctx.fillRect(M, y, W - M * 2, rh);
    }
    const disc = roundTo100(it.supply * (1 - it.rate));
    const qty = it.qty || 1;
    totQty += qty; totNormal += it.supply * qty; totDisc += disc * qty;

    const midY = y + rh / 2 + 6;
    x = M;
    const cell = (text: string, col: number, opt?: { color?: string; bold?: boolean; lines?: string[] }) => {
      const [, w, align] = COLS[col];
      ctx.fillStyle = opt?.color || INK;
      ctx.font = F(17, opt?.bold ? 700 : 400);
      ctx.textAlign = align;
      const tx = align === 'left' ? x + 10 : align === 'right' ? x + w - 10 : x + w / 2;
      if (opt?.lines && opt.lines.length > 1) {
        ctx.font = F(16.5, opt?.bold ? 700 : 400);
        ctx.fillText(opt.lines[0], tx, y + rh / 2 - 4);
        ctx.fillText(opt.lines[1], tx, y + rh / 2 + 17);
      } else {
        ctx.fillText(text, tx, midY);
      }
      x += w;
    };
    cell(String(i + 1), 0, { color: SUB });
    cell(it.country || '', 1, { color: SUB });
    cell(it.name, 2, { bold: true, lines: lines[i] });
    cell(it.vintage || '', 3, { color: SUB });
    cell(won(it.supply), 4);
    cell(`${Math.round(it.rate * 100)}%`, 5, { color: RED, bold: true });
    cell(won(disc), 6, { color: RED, bold: true });
    cell(String(qty), 7);
    cell(won(disc * qty), 8, { bold: true });

    ctx.strokeStyle = '#e5e0da';
    ctx.beginPath(); ctx.moveTo(M, y + rh); ctx.lineTo(W - M, y + rh); ctx.stroke();
    y += rh;
  });

  // ── 합계 행 ──
  ctx.fillStyle = '#efe9e3';
  ctx.fillRect(M, y, W - M * 2, sumH);
  ctx.fillStyle = INK;
  ctx.font = F(18, 800);
  ctx.textAlign = 'center';
  ctx.fillText('합계', M + COLS[0][1] + COLS[1][1] + COLS[2][1] / 2, y + 33);
  ctx.textAlign = 'right';
  const rightOf = (colIdx: number) => M + COLS.slice(0, colIdx + 1).reduce((a, c) => a + c[1], 0) - 10;
  ctx.fillText(String(totQty), rightOf(7), y + 33);
  ctx.fillText(won(totDisc), rightOf(8), y + 33);
  ctx.font = F(14);
  ctx.fillStyle = SUB;
  ctx.fillText(`정상 ${won(totNormal)}원 → 할인 ${won(totDisc)}원`, rightOf(6), y + 33);
  y += sumH;

  // ── 푸터 ──
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = F(20, 800);
  ctx.fillText('(주) 까 브 드 뱅', W - M, y + 46);
  ctx.font = F(13);
  ctx.fillStyle = SUB;
  ctx.fillText('본 견적은 발행일로부터 유효하며, 재고 소진 시 조기 마감될 수 있습니다.', W - M, y + 70);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 생성 실패'))), 'image/png');
  });
}
