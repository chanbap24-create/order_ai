// 견적서 PNG 렌더러 — 카톡 전송용. 엑셀 견적서 양식(로고·공문 문구·컬럼·합계·직인생략)을
// 캔버스로 최대한 동일하게 재현. 컬럼 구성·순서는 엑셀과 같은 사용자 설정(uiKey 배열)을 따른다.
import { roundTo100 } from '@/app/lib/priceUtils';

export interface QuoteImageItem {
  name: string;
  country?: string;
  brand?: string;
  region?: string;
  grape?: string;
  vintage?: string;
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

/** 상품명 앞 브랜드 약어(예: 'SU ', 'LG ') 제거 — 엑셀 견적과 동일 표기 */
const stripPrefix = (name: string) => (name || '').replace(/^[A-Za-z]{2}\s+/, '').trim();

// ── 엑셀 견적서 기본 문구(quote/export DEFAULT_DOC와 동일) ──
const DOC = {
  companyName: '(주) 까 브 드 뱅',
  address: '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-786-3136 / FAX: 02-785-5719',
  addressEn: 'Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA',
  websiteUrl: 'www.cavedevin.com',
  sender: '(주)까브드뱅',
  title: '와인 제안의 건',
  content1: '1. 귀사의 일익 번창하심을 기원합니다.',
  content2: '2. 아래와 같이 와인 견적을 보내드리오니 검토하여 주시기 바랍니다.',
  content3: '- 아         래 -',
  priceLine: '1. 제품 및 가격 :',
  unit: '단위 : VAT별도, WON, BTL.',
  representative: '대표이사 유병우',
  sealText: '-직인생략-',
  ending: '-끝.-',
};

const HEAD_BG = '#3b2723';   // 표 헤더 딥브라운(엑셀과 동일 계열)
const ZEBRA = '#f6f1ec';
const SUM_BG = '#efe8e1';
const RED = '#c00000';
const INK = '#1a1a1a';
const SUB = '#555';
const LINE = '#d9d2ca';

const F = (px: number, w: 400 | 600 | 700 | 800 = 400) =>
  `${w} ${px}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const won = (n: number) => n.toLocaleString();

// 컬럼 메타(uiKey → 라벨·폭·정렬) — 엑셀 컬럼 정의와 대응. 이미지·테이스팅노트는 PNG 제외.
type Align = 'left' | 'center' | 'right';
type ColDef = { label: string; w: number; align: Align };
const COL_META: Record<string, ColDef> = {
  country: { label: '국가', w: 88, align: 'center' },
  brand: { label: '브랜드', w: 150, align: 'center' },
  region: { label: '지역', w: 170, align: 'center' },
  grape_varieties: { label: '포도품종', w: 150, align: 'center' },
  vintage: { label: '빈티지', w: 82, align: 'center' },
  product_name: { label: '상품명', w: 380, align: 'left' },
  supply_price: { label: '공급가', w: 112, align: 'right' },
  discount_rate: { label: '할인율', w: 76, align: 'center' },
  discounted_price: { label: '할인가', w: 112, align: 'right' },
  note: { label: '비고', w: 150, align: 'center' },
  quantity: { label: '수량', w: 66, align: 'right' },
  normal_total: { label: '정상공급가합계', w: 150, align: 'right' },
  discount_total: { label: '할인공급가합계', w: 150, align: 'right' },
};
const DEFAULT_PNG_COLS = [
  'country', 'brand', 'region', 'vintage', 'product_name',
  'supply_price', 'discount_rate', 'discounted_price', 'note',
  'quantity', 'normal_total', 'discount_total',
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

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logos/cavedevin.png';
  });
}

/** 견적서 PNG Blob 생성 — 엑셀 양식 재현(여백 포함) */
export async function renderQuoteImage(opts: {
  clientName: string;
  date: string;              // YYYY-MM-DD
  items: QuoteImageItem[];
  cols?: string[];           // 엑셀과 동일한 uiKey 배열(순서 = 열 순서). 없으면 기본 구성
}): Promise<Blob> {
  const items = opts.items;
  const colKeys = (opts.cols && opts.cols.length ? opts.cols : DEFAULT_PNG_COLS)
    .filter((k) => COL_META[k]);
  const cols: Array<{ key: string } & ColDef> = [
    { key: 'no', label: 'No.', w: 54, align: 'center' },
    ...colKeys.map((k) => ({ key: k, ...COL_META[k] })),
  ];
  const tableW = cols.reduce((a, c) => a + c.w, 0);
  const M = 44;
  const W = tableW + M * 2;

  const logo = await loadLogo();
  const canvas = document.createElement('canvas');
  const probe = canvas.getContext('2d')!;

  // 행 높이(상품명 2줄 래핑 기준) — 엑셀처럼 위아래 여유 있게
  probe.font = F(17, 700);
  const nameCol = cols.find((c) => c.key === 'product_name');
  const nameLines = items.map((it) =>
    nameCol ? wrap2(probe, stripPrefix(it.name), nameCol.w - 18) : [stripPrefix(it.name)]);
  const rowHs = nameLines.map((l) => (l.length > 1 ? 78 : 58));

  // ── 헤더 레이아웃(엑셀의 빈 행 간격 재현) — 동적 계산 ──
  const TOP = 44;
  const logoW = logo ? Math.min(300, logo.width) : 0;
  const logoH = logo ? logoW * (logo.height / logo.width) : 56;
  const GAP_LOGO = 40;        // 로고 ↔ 주소
  const ADDR = 22 + 20 + 20;  // 주소 3줄
  const GAP_ADDR = 56;        // 주소 ↔ 수신 (엑셀 5~8행 공백)
  const L_RECV = 38, L_SEND = 38, L_TITLE = 44;
  const L_C1 = 34, L_C2 = 42;
  const L_BELOW = 42;         // - 아 래 -
  const L_PRICE = 30;         // 1. 제품 및 가격 :
  const GAP_TABLE = 16;
  const headerH = TOP + logoH + GAP_LOGO + ADDR + GAP_ADDR
    + L_RECV + L_SEND + L_TITLE + L_C1 + L_C2 + L_BELOW + L_PRICE + GAP_TABLE;

  const thH = 52;
  const sumH = 58;
  const footH = 210;          // -끝.- + 여백 + 서명 블록(엑셀 29~35행)
  const H = headerH + thH + rowHs.reduce((a, b) => a + b, 0) + sumH + footH;

  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // ── 로고 + 주소 ──
  let y = TOP;
  if (logo) {
    ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
  } else {
    ctx.fillStyle = '#7b1f24';
    ctx.font = '700 36px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAVE DE VIN', W / 2, y + 40);
  }
  y += logoH + GAP_LOGO;
  ctx.textAlign = 'center';
  ctx.fillStyle = SUB;
  ctx.font = F(13);
  ctx.fillText(DOC.address, W / 2, y); y += 22;
  ctx.font = F(12);
  ctx.fillText(DOC.addressEn, W / 2, y); y += 20;
  ctx.fillText(DOC.websiteUrl, W / 2, y); y += 20;
  y += GAP_ADDR - 20;

  // ── 수신/발신/제목 + 날짜 ──
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = F(17);
  ctx.fillText(`수      신 : ${opts.clientName}`, M, y);
  ctx.textAlign = 'right';
  ctx.fillText(opts.date, W - M, y);
  y += L_RECV;
  ctx.textAlign = 'left';
  ctx.fillText(`발      신 : ${DOC.sender}`, M, y); y += L_SEND;
  ctx.font = F(17, 700);
  ctx.fillText(`제      목 : ${DOC.title}`, M, y); y += L_TITLE;
  ctx.font = F(16);
  ctx.fillText(DOC.content1, M, y); y += L_C1;
  ctx.fillText(DOC.content2, M, y); y += L_C2;
  ctx.textAlign = 'center';
  ctx.fillText(DOC.content3, W / 2, y); y += L_BELOW;
  ctx.textAlign = 'left';
  ctx.fillText(DOC.priceLine, M, y);
  ctx.textAlign = 'right';
  ctx.font = F(14);
  ctx.fillText(DOC.unit, W - M, y);
  y = headerH;

  // ── 표 헤더 ──
  ctx.fillStyle = HEAD_BG;
  ctx.fillRect(M, y, tableW, thH);
  ctx.fillStyle = '#fff';
  ctx.font = F(15, 700);
  let x = M;
  for (const c of cols) {
    ctx.textAlign = 'center';
    ctx.fillText(c.label, x + c.w / 2, y + 33);
    x += c.w;
  }
  y += thH;

  // ── 데이터 행 ──
  let totQty = 0, totNormal = 0, totDisc = 0;
  items.forEach((it, i) => {
    const rh = rowHs[i];
    if (i % 2 === 1) { ctx.fillStyle = ZEBRA; ctx.fillRect(M, y, tableW, rh); }
    const disc = roundTo100(it.supply * (1 - it.rate));
    const qty = it.qty || 1;
    totQty += qty; totNormal += it.supply * qty; totDisc += disc * qty;

    const valueOf = (key: string): string => {
      switch (key) {
        case 'no': return String(i + 1);
        case 'country': return it.country || '';
        case 'brand': return it.brand || '';
        case 'region': return it.region || '';
        case 'grape_varieties': return it.grape || '';
        case 'vintage': return it.vintage || '';
        case 'product_name': return stripPrefix(it.name);
        case 'supply_price': return won(it.supply);
        case 'discount_rate': return it.rate > 0 ? `${Math.round(it.rate * 100)}%` : '';
        case 'discounted_price': return it.rate > 0 ? won(disc) : '';
        case 'note': return it.note || '';
        case 'quantity': return String(qty);
        case 'normal_total': return won(it.supply * qty);
        case 'discount_total': return won(disc * qty);
        default: return '';
      }
    };

    const midY = y + rh / 2 + 6;
    x = M;
    for (const c of cols) {
      const red = c.key === 'discount_rate' || c.key === 'discounted_price';
      ctx.fillStyle = red ? RED : c.key === 'no' || c.key === 'country' || c.key === 'vintage' ? SUB : INK;
      const bold = c.key === 'product_name';
      ctx.textAlign = c.align;
      const tx = c.align === 'left' ? x + 9 : c.align === 'right' ? x + c.w - 9 : x + c.w / 2;
      if (c.key === 'product_name' && nameLines[i].length > 1) {
        ctx.font = F(15.5, 700);
        ctx.fillText(nameLines[i][0], tx, y + rh / 2 - 5);
        ctx.fillText(nameLines[i][1], tx, y + rh / 2 + 18);
      } else if (c.key === 'region' || c.key === 'grape_varieties' || c.key === 'brand' || c.key === 'note') {
        ctx.font = F(14.5);
        const t = wrap2(ctx, valueOf(c.key), c.w - 16)[0];
        ctx.fillText(t, tx, midY);
      } else {
        ctx.font = F(bold ? 16 : 15.5, bold ? 700 : 400);
        ctx.fillText(valueOf(c.key), tx, midY);
      }
      x += c.w;
    }
    ctx.strokeStyle = LINE;
    ctx.beginPath(); ctx.moveTo(M, y + rh); ctx.lineTo(M + tableW, y + rh); ctx.stroke();
    y += rh;
  });

  // ── 합계 행 ──
  ctx.fillStyle = SUM_BG;
  ctx.fillRect(M, y, tableW, sumH);
  ctx.fillStyle = INK;
  x = M;
  for (const c of cols) {
    ctx.font = F(16, 800);
    ctx.textAlign = c.align === 'left' ? 'left' : c.align;
    const tx = c.align === 'left' ? x + 9 : c.align === 'right' ? x + c.w - 9 : x + c.w / 2;
    const v = c.key === 'product_name' ? '합계'
      : c.key === 'quantity' ? String(totQty)
      : c.key === 'normal_total' ? won(totNormal)
      : c.key === 'discount_total' ? won(totDisc)
      : '';
    if (v) ctx.fillText(v, tx, y + 37);
    x += c.w;
  }
  if (!cols.some((c) => c.key === 'discount_total')) {
    ctx.textAlign = 'right';
    ctx.font = F(15, 800);
    ctx.fillText(`합계 ${totQty}병 · ${won(totDisc)}원`, M + tableW - 9, y + 37);
  }
  y += sumH;

  // ── 끝 + 서명 (엑셀처럼 여유 있게) ──
  ctx.textAlign = 'right';
  ctx.fillStyle = SUB;
  ctx.font = F(14);
  ctx.fillText(DOC.ending, W - M, y + 34);
  ctx.fillStyle = INK;
  ctx.font = F(24, 800);
  ctx.fillText(DOC.companyName, W - M, y + 118);
  ctx.font = F(17, 700);
  ctx.fillText(DOC.representative, W - M, y + 150);
  ctx.fillStyle = SUB;
  ctx.font = F(13);
  ctx.fillText(DOC.sealText, W - M, y + 176);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 생성 실패'))), 'image/png');
  });
}
