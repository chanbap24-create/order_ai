import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import { ensureWineProfileTable } from '@/app/lib/wineProfileDb';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

interface DocSettings {
  companyName: string;
  address: string;
  addressEn: string;
  websiteUrl: string;
  sender: string;
  title: string;
  content1: string;
  content2: string;
  content3: string;
  unit: string;
  representative: string;
  sealText: string;
}

interface ColDef {
  uiKey: string | null; // null = always shown (No.)
  label: string;
  width: number;
  type: 'index' | 'text' | 'currency' | 'percent' | 'number' | 'formula' | 'link' | 'image';
  dataField?: string;
}

const ALL_EXCEL_COLUMNS: ColDef[] = [
  { uiKey: null, label: 'No.', width: 5, type: 'index' },
  { uiKey: 'item_code', label: '품목코드', width: 11, type: 'text', dataField: 'item_code' },
  { uiKey: 'country', label: '국가', width: 8, type: 'text', dataField: 'country' },
  { uiKey: 'brand', label: '브랜드', width: 14, type: 'text', dataField: 'brand' },
  { uiKey: 'region', label: '지역', width: 10, type: 'text', dataField: 'region' },
  { uiKey: 'image_url', label: '이미지', width: 10, type: 'image' },
  { uiKey: 'vintage', label: '빈티지', width: 8, type: 'text', dataField: 'vintage' },
  { uiKey: 'product_name', label: '상품명', width: 35, type: 'text', dataField: 'product_name' },
  { uiKey: 'english_name', label: '영문명', width: 30, type: 'text', dataField: 'english_name' },
  { uiKey: 'korean_name', label: '한글명', width: 30, type: 'text', dataField: 'korean_name' },
  { uiKey: 'supply_price', label: '공급가', width: 12, type: 'currency', dataField: 'supply_price' },
  { uiKey: 'retail_price', label: '소비자가', width: 12, type: 'currency', dataField: 'retail_price' },
  { uiKey: 'discount_rate', label: '할인율', width: 8, type: 'percent', dataField: 'discount_rate' },
  { uiKey: 'discounted_price', label: '할인가', width: 12, type: 'formula' },
  { uiKey: 'quantity', label: '수량', width: 6, type: 'number', dataField: 'quantity' },
  { uiKey: 'normal_total', label: '정상공급가합계', width: 14, type: 'formula' },
  { uiKey: 'discount_total', label: '할인공급가합계', width: 14, type: 'formula' },
  { uiKey: 'retail_normal_total', label: '정상소비자가합계', width: 15, type: 'formula' },
  { uiKey: 'retail_discount_total', label: '할인소비자가합계', width: 15, type: 'formula' },
  { uiKey: 'grape_varieties', label: '포도품종', width: 20, type: 'text', dataField: 'grape_varieties' },
  { uiKey: 'note', label: '비고', width: 15, type: 'text', dataField: 'note' },
  { uiKey: 'tasting_note', label: '테이스팅노트', width: 18, type: 'link' },
];

const DEFAULT_DOC: DocSettings = {
  companyName: '(주) 까 브 드 뱅',
  address: '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444',
  addressEn: 'Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA',
  websiteUrl: 'www.cavedevin.co.kr',
  sender: '(주)까브드뱅',
  title: '와인 제안의 건',
  content1: '1. 귀사의 일익 번창하심을 기원합니다.',
  content2: '2. 아래와 같이 와인 견적을 보내드리오니 검토하여 주시기 바랍니다.',
  content3: '- 아         래 -',
  unit: '단위 : VAT별도, WON, BTL.',
  representative: '대표이사 유병우',
  sealText: '-직인생략-',
};

// ═══════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════

const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';
const TASTING_NOTE_INDEX_URL = `${TASTING_NOTE_BASE_URL}/tasting-notes-index.json`;

function getLogoPath(company: string): string | null {
  const filename = company === 'DL' ? 'riedel.png' : 'cavedevin.png';
  // Try multiple possible paths (local dev + Vercel)
  const candidates = [
    path.join(process.cwd(), 'public', 'logos', filename),
    path.join(process.cwd(), 'logos', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const BOTTLE_IMG_DIR = path.join(process.cwd(), 'public', 'bottle-images');

function getBottleImagePath(itemCode: string): string | null {
  // DB에서 파일명 조회
  try {
    const row = db.prepare('SELECT filename FROM bottle_images WHERE item_code = ?').get(itemCode) as any;
    if (row?.filename) {
      const p = path.join(BOTTLE_IMG_DIR, row.filename);
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  // fallback: 직접 파일 탐색
  for (const ext of ['png', 'jpg', 'jpeg', 'tiff']) {
    const p = path.join(BOTTLE_IMG_DIR, `${itemCode}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function loadTastingNoteIndex(): Promise<Set<string>> {
  try {
    const res = await fetch(`${TASTING_NOTE_INDEX_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const s = new Set<string>();
    for (const [k, v] of Object.entries(data.notes || {} as Record<string, any>)) {
      if ((v as any)?.exists) s.add(k);
    }
    return s;
  } catch {
    return new Set();
  }
}

const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};
const CURR = '#,##0';
const PCT = '0%';
const BLUE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAF8' } };
const YELLOW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

function fmtDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function colLetter(n: number): string {
  return String.fromCharCode(64 + n);
}

function sc(
  row: ExcelJS.Row, col: number, value: any,
  o?: { border?: Partial<ExcelJS.Borders>; fmt?: string; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: string; fill?: ExcelJS.Fill; size?: number; wrap?: boolean }
) {
  const cell = row.getCell(col);
  cell.value = value;
  if (o?.border) cell.border = o.border;
  if (o?.fmt) cell.numFmt = o.fmt;
  cell.alignment = {
    horizontal: o?.align ?? (typeof value === 'number' ? 'right' : 'center'),
    vertical: 'middle',
    wrapText: o?.wrap ?? false,
  };
  const font: Partial<ExcelJS.Font> = { name: '굴림' };
  if (o?.bold) font.bold = true;
  if (o?.color) font.color = { argb: o.color };
  if (o?.size) font.size = o.size;
  cell.font = font;
  if (o?.fill) cell.fill = o.fill;
}

function sf(
  row: ExcelJS.Row, col: number, formula: string,
  o?: { border?: Partial<ExcelJS.Borders>; fmt?: string; bold?: boolean; color?: string; fill?: ExcelJS.Fill }
) {
  const cell = row.getCell(col);
  cell.value = { formula } as ExcelJS.CellFormulaValue;
  if (o?.border) cell.border = o.border;
  if (o?.fmt) cell.numFmt = o.fmt;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  const font: Partial<ExcelJS.Font> = { name: '굴림' };
  if (o?.bold) font.bold = true;
  if (o?.color) font.color = { argb: o.color };
  cell.font = font;
  if (o?.fill) cell.fill = o.fill;
}

// ═══════════════════════════════════════
// GET handler
// ═══════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    ensureQuoteTable();
    ensureWineProfileTable();
    const clientName = request.nextUrl.searchParams.get('client_name') || '';
    const items = db.prepare(`
      SELECT q.*, wp.grape_varieties
      FROM quote_items q
      LEFT JOIN wine_profiles wp ON q.item_code = wp.item_code
      ORDER BY q.id ASC
    `).all() as any[];

    // Parse visible columns
    const columnsParam = request.nextUrl.searchParams.get('columns');
    let visibleColumns: string[] = [];
    if (columnsParam) {
      try { visibleColumns = JSON.parse(columnsParam); } catch {}
    }

    // Parse doc settings
    const settingsParam = request.nextUrl.searchParams.get('doc_settings');
    let docSettings: DocSettings = { ...DEFAULT_DOC };
    if (settingsParam) {
      try { docSettings = { ...docSettings, ...JSON.parse(settingsParam) }; } catch {}
    }

    // Parse company
    const company = request.nextUrl.searchParams.get('company') || 'CDV';

    // Filter active columns based on visibility
    const activeCols = ALL_EXCEL_COLUMNS.filter(
      c => c.uiKey === null || visibleColumns.includes(c.uiKey)
    );

    // Load tasting note index for existence check
    const tastingNoteSet = await loadTastingNoteIndex();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    buildQuote(workbook, items, clientName, activeCols, docSettings, company, tastingNoteSet);

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `견적서_${dateStr}_${clientName || '미지정'}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Quote export error:', error);
    return NextResponse.json(
      { error: '엑셀 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════
// Unified quote builder
// ═══════════════════════════════════════

function buildQuote(
  wb: ExcelJS.Workbook,
  items: any[],
  clientName: string,
  activeCols: ColDef[],
  doc: DocSettings,
  company: string,
  tastingNoteSet: Set<string>
) {
  const ws = wb.addWorksheet('견적서');
  const totalCols = activeCols.length;
  const lastCol = colLetter(totalCols);

  // Set column widths
  ws.columns = activeCols.map(c => ({ width: c.width }));

  // Build column position map (uiKey -> 1-based col index)
  const pos: Record<string, number> = {};
  activeCols.forEach((c, i) => {
    if (c.uiKey) pos[c.uiKey] = i + 1;
  });

  // ── Document header ──

  // Row 1: spacer
  ws.getRow(1).height = 10;

  // Row 2: spacer (로고 위 여백)
  ws.getRow(2).height = 14;

  // Row 3: Company logo or name
  ws.mergeCells(`A3:${lastCol}3`);
  const logoPath = getLogoPath(company);
  if (logoPath) {
    const logoBuffer = fs.readFileSync(logoPath);
    const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
    const imgH = company === 'DL' ? 150 : 100;
    const imgW = company === 'DL' ? Math.round(231 * (150 / 160)) : Math.round(307 * (100 / 100));
    const rowHeight = imgH + 10;
    ws.getRow(3).height = rowHeight * 0.75;
    const totalWidthPx = activeCols.reduce((sum, c) => sum + c.width * 7.5, 0);
    const offsetPx = (totalWidthPx - imgW) / 2;
    let accPx = 0;
    let centerCol = 0;
    for (let i = 0; i < activeCols.length; i++) {
      const colPx = activeCols[i].width * 7.5;
      if (accPx + colPx > offsetPx) {
        centerCol = i + (offsetPx - accPx) / colPx;
        break;
      }
      accPx += colPx;
    }
    ws.addImage(logoId, {
      tl: { col: centerCol, row: 2 } as ExcelJS.Anchor,
      ext: { width: imgW, height: imgH },
    });
  } else {
    const titleCell = ws.getCell('A3');
    titleCell.value = doc.companyName;
    titleCell.font = { name: '굴림', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 30;
  }

  // Row 4: 한글 주소
  ws.mergeCells(`A4:${lastCol}4`);
  ws.getCell('A4').value = doc.address;
  ws.getCell('A4').font = { name: '굴림', size: 8 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 5: 영문 주소
  ws.mergeCells(`A5:${lastCol}5`);
  ws.getCell('A5').value = doc.addressEn || '';
  ws.getCell('A5').font = { name: '굴림', size: 7 };
  ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 6: 웹사이트/SNS URL
  ws.mergeCells(`A6:${lastCol}6`);
  ws.getCell('A6').value = doc.websiteUrl || '';
  ws.getCell('A6').font = { name: '굴림', size: 7 };
  ws.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 7~10: spacer (URL ↔ 수신 여백 4줄)
  ws.getRow(7).height = 16.5;
  ws.getRow(8).height = 16.5;
  ws.getRow(9).height = 16.5;
  ws.getRow(10).height = 16.5;

  // Row 11: 수신 + date
  ws.getCell('A11').value = `수      신 : ${clientName || ''}`;
  ws.getCell('A11').font = { name: '굴림', size: 11 };
  ws.getCell(`${lastCol}11`).value = fmtDate(new Date());
  ws.getCell(`${lastCol}11`).font = { name: '굴림', size: 11 };
  ws.getCell(`${lastCol}11`).alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 12: spacer (수신↔발신)
  ws.getRow(12).height = 12.5;

  // Row 13: 발신
  ws.getCell('A13').value = `발      신 : ${doc.sender}`;
  ws.getCell('A13').font = { name: '굴림', size: 11 };

  // Row 14: spacer (발신↔제목)
  ws.getRow(14).height = 12.5;

  // Row 15: 제목
  ws.getCell('A15').value = `제    목 : ${doc.title}`;
  ws.getCell('A15').font = { name: '굴림', size: 11, bold: true };

  // Row 16: spacer
  ws.getRow(16).height = 8;

  // Row 17: 내용 1
  ws.getCell('A17').value = doc.content1;
  ws.getCell('A17').font = { name: '굴림', size: 11 };

  // Row 18: spacer (내용1↔내용2)
  ws.getRow(18).height = 12.5;

  // Row 19: 내용 2
  ws.getCell('A19').value = doc.content2;
  ws.getCell('A19').font = { name: '굴림', size: 11 };

  // Row 20: spacer
  ws.getRow(20).height = 8;

  // Row 21: 내용 3 (centered)
  ws.mergeCells(`A21:${lastCol}21`);
  ws.getCell('A21').value = doc.content3;
  ws.getCell('A21').font = { name: '굴림', size: 11 };
  ws.getCell('A21').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 22: 제품 및 가격 + 단위
  ws.getCell('A22').value = '1. 제품 및 가격 :';
  ws.getCell('A22').font = { name: '굴림', size: 10 };
  const unitStartCol = colLetter(Math.max(1, totalCols - 2));
  if (totalCols > 3) {
    ws.mergeCells(`${unitStartCol}22:${lastCol}22`);
  }
  ws.getCell(`${unitStartCol}22`).value = doc.unit;
  ws.getCell(`${unitStartCol}22`).font = { name: '굴림', size: 11, bold: true };
  ws.getCell(`${unitStartCol}22`).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(`${unitStartCol}22`).border = { bottom: { style: 'medium' } };

  // ── Column headers (Row 23) ──
  const hBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium' }, bottom: { style: 'double' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
  const hRow = ws.getRow(23);
  hRow.height = 32;
  activeCols.forEach((col, i) => {
    sc(hRow, i + 1, col.label, { border: hBorder, fill: BLUE_FILL, bold: true, size: 10, wrap: true });
  });

  // ── Data rows (Row 24+) ──
  const DS = 24;
  const hasImageCol = activeCols.some(c => c.type === 'image');
  const IMG_ROW_HEIGHT = 75; // points when image column is active

  items.forEach((item: any, idx: number) => {
    const r = DS + idx;
    const row = ws.getRow(r);
    row.height = hasImageCol ? IMG_ROW_HEIGHT : 24;

    activeCols.forEach((col, ci) => {
      const c = ci + 1;

      // No.
      if (col.type === 'index') {
        sc(row, c, idx + 1, { border: THIN });
        return;
      }

      // Image column (wine bottle)
      if (col.type === 'image') {
        const cell = row.getCell(c);
        cell.border = THIN;
        const itemCode = item.item_code || '';
        const imgPath = itemCode ? getBottleImagePath(itemCode) : null;
        if (imgPath) {
          const rawExt = path.extname(imgPath).replace('.', '').toLowerCase();
          if (rawExt === 'tiff' || rawExt === 'tif') {
            sc(row, c, itemCode, { border: THIN, size: 8, color: 'FF999999' });
          } else {
            const imgBuf = fs.readFileSync(imgPath);
            const ext = (rawExt === 'jpg' ? 'jpeg' : rawExt) as 'png' | 'jpeg' | 'gif';
            const imgId = wb.addImage({ buffer: imgBuf, extension: ext });
            // DB에서 원본 크기 조회하여 비율 유지
            let origW = 1, origH = 2;
            try {
              const meta = db.prepare('SELECT width, height FROM bottle_images WHERE item_code = ?').get(itemCode) as any;
              if (meta?.width && meta?.height) { origW = meta.width; origH = meta.height; }
            } catch {}

            // EMU 단위로 정확한 셀 크기 계산
            const PT_EMU = 12700;
            const PX_EMU = 9525;
            const colWEmu = Math.round((10 * 7 + 5) * PX_EMU);  // 컬럼10 = 75px = 714375 EMU
            const rowHEmu = IMG_ROW_HEIGHT * PT_EMU;              // 75pt = 952500 EMU
            const padEmu = 2 * PX_EMU;                            // 2px 여백

            // 비율 유지하며 축소
            const availW = colWEmu - padEmu * 2;
            const availH = rowHEmu - padEmu * 2;
            const imgRatio = origW / origH;
            let imgWEmu: number, imgHEmu: number;
            if (availW / availH > imgRatio) {
              imgHEmu = availH;
              imgWEmu = Math.round(imgHEmu * imgRatio);
            } else {
              imgWEmu = availW;
              imgHEmu = Math.round(imgWEmu / imgRatio);
            }

            // 셀 내 중앙정렬 오프셋 (EMU)
            const offL = Math.round((colWEmu - imgWEmu) / 2);
            const offT = Math.round((rowHEmu - imgHEmu) / 2);

            // nativeCol/nativeRow + offset(EMU)로 셀에 직접 고정
            ws.addImage(imgId, {
              tl: { nativeCol: ci, nativeColOff: offL, nativeRow: r - 1, nativeRowOff: offT } as any,
              br: { nativeCol: ci, nativeColOff: offL + imgWEmu, nativeRow: r - 1, nativeRowOff: offT + imgHEmu } as any,
              editAs: 'oneCell',
            } as any);
          }
        }
        return;
      }

      // Formula columns
      if (col.type === 'formula') {
        if (col.uiKey === 'discounted_price') {
          if (pos['supply_price'] && pos['discount_rate']) {
            const sp = colLetter(pos['supply_price']);
            const dr = colLetter(pos['discount_rate']);
            sf(row, c, `IFERROR(${sp}${r}*(1-${dr}${r}),"")`, { border: THIN, fmt: CURR, color: 'FFFF0000' });
          } else {
            sc(row, c, Math.round((item.supply_price || 0) * (1 - (item.discount_rate || 0))), { border: THIN, fmt: CURR, color: 'FFFF0000' });
          }
        } else if (col.uiKey === 'normal_total') {
          if (pos['supply_price'] && pos['quantity']) {
            const sp = colLetter(pos['supply_price']);
            const qty = colLetter(pos['quantity']);
            sf(row, c, `IFERROR(${sp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR });
          } else {
            sc(row, c, (item.supply_price || 0) * (item.quantity || 0), { border: THIN, fmt: CURR });
          }
        } else if (col.uiKey === 'discount_total') {
          if (pos['supply_price'] && pos['discount_rate'] && pos['quantity']) {
            const sp = colLetter(pos['supply_price']);
            const dr = colLetter(pos['discount_rate']);
            const qty = colLetter(pos['quantity']);
            sf(row, c, `IFERROR(${sp}${r}*(1-${dr}${r})*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: YELLOW_FILL });
          } else if (pos['discounted_price'] && pos['quantity']) {
            const dp = colLetter(pos['discounted_price']);
            const qty = colLetter(pos['quantity']);
            sf(row, c, `IFERROR(${dp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: YELLOW_FILL });
          } else {
            const dp = Math.round((item.supply_price || 0) * (1 - (item.discount_rate || 0)));
            sc(row, c, dp * (item.quantity || 0), { border: THIN, fmt: CURR, fill: YELLOW_FILL });
          }
        } else if (col.uiKey === 'retail_normal_total') {
          if (pos['retail_price'] && pos['quantity']) {
            const rp = colLetter(pos['retail_price']);
            const qty = colLetter(pos['quantity']);
            sf(row, c, `IFERROR(${rp}${r}*${qty}${r},"")`, { border: THIN, fmt: CURR });
          } else {
            sc(row, c, (item.retail_price || 0) * (item.quantity || 0), { border: THIN, fmt: CURR });
          }
        } else if (col.uiKey === 'retail_discount_total') {
          if (pos['retail_price'] && pos['discount_rate'] && pos['quantity']) {
            const rp = colLetter(pos['retail_price']);
            const dr = colLetter(pos['discount_rate']);
            const qty = colLetter(pos['quantity']);
            sf(row, c, `IFERROR(${rp}${r}*(1-${dr}${r})*${qty}${r},"")`, { border: THIN, fmt: CURR, fill: YELLOW_FILL });
          } else {
            const rdp = Math.round((item.retail_price || 0) * (1 - (item.discount_rate || 0)));
            sc(row, c, rdp * (item.quantity || 0), { border: THIN, fmt: CURR, fill: YELLOW_FILL });
          }
        }
        return;
      }

      // Link column (tasting note)
      if (col.type === 'link') {
        const itemCode = item.item_code || '';
        if (itemCode) {
          const exists = tastingNoteSet.has(itemCode);
          const pdfUrl = `${TASTING_NOTE_BASE_URL}/${itemCode}.pdf`;
          const cell = row.getCell(c);
          if (exists) {
            cell.value = { text: '테이스팅노트', hyperlink: pdfUrl } as ExcelJS.CellHyperlinkValue;
            cell.font = { name: '굴림', size: 9, color: { argb: 'FF27AE60' }, underline: true };
          } else {
            cell.value = '테이스팅노트(없음)';
            cell.font = { name: '굴림', size: 9, color: { argb: 'FF8B1538' } };
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = THIN;
        } else {
          sc(row, c, '', { border: THIN });
        }
        return;
      }

      // Regular data columns
      const val = col.dataField ? (item[col.dataField] ?? '') : '';

      if (col.type === 'currency') {
        sc(row, c, Number(val) || 0, { border: THIN, fmt: CURR });
      } else if (col.type === 'percent') {
        sc(row, c, Number(val) || 0, { border: THIN, fmt: PCT, color: 'FFFF0000', align: 'center' });
      } else if (col.type === 'number') {
        sc(row, c, Number(val) || 0, { border: THIN, align: 'center' });
      } else {
        const leftAlign = ['product_name', 'english_name', 'korean_name', 'note', 'tasting_note', 'region', 'grape_varieties'].includes(col.uiKey || '');
        const bold = col.uiKey === 'product_name' || col.uiKey === 'korean_name';
        const isNote = col.uiKey === 'note';
        sc(row, c, String(val), {
          border: THIN,
          align: leftAlign ? 'left' : 'center',
          bold,
          wrap: true,
          color: isNote ? 'FFFF0000' : undefined,
          size: (col.uiKey === 'tasting_note' || col.uiKey === 'note') ? 9 : undefined,
        });
      }
    });
  });

  // ── Summary row ──
  if (items.length > 0) {
    const sumR = DS + items.length;
    const row = ws.getRow(sumR);
    row.height = 28;

    for (let c = 1; c <= totalCols; c++) {
      row.getCell(c).border = THIN;
      row.getCell(c).fill = YELLOW_FILL;
    }

    // "합계" label in best column
    const labelCol = pos['product_name'] || pos['korean_name'] || pos['english_name'] || pos['item_code'] || 1;
    sc(row, labelCol, '합계', { border: THIN, fill: YELLOW_FILL, bold: true, size: 11 });

    // Quantity sum
    if (pos['quantity']) {
      const cl = colLetter(pos['quantity']);
      sf(row, pos['quantity'], `SUM(${cl}${DS}:${cl}${sumR - 1})`, { border: THIN, bold: true, fill: YELLOW_FILL });
    }

    // Normal total sum
    if (pos['normal_total']) {
      const cl = colLetter(pos['normal_total']);
      sf(row, pos['normal_total'], `SUM(${cl}${DS}:${cl}${sumR - 1})`, { border: THIN, fmt: CURR, bold: true, fill: YELLOW_FILL });
    }

    // Discount total sum
    if (pos['discount_total']) {
      const cl = colLetter(pos['discount_total']);
      sf(row, pos['discount_total'], `SUM(${cl}${DS}:${cl}${sumR - 1})`, { border: THIN, fmt: CURR, bold: true, fill: YELLOW_FILL });
    }

    // Retail normal total sum
    if (pos['retail_normal_total']) {
      const cl = colLetter(pos['retail_normal_total']);
      sf(row, pos['retail_normal_total'], `SUM(${cl}${DS}:${cl}${sumR - 1})`, { border: THIN, fmt: CURR, bold: true, fill: YELLOW_FILL });
    }

    // Retail discount total sum
    if (pos['retail_discount_total']) {
      const cl = colLetter(pos['retail_discount_total']);
      sf(row, pos['retail_discount_total'], `SUM(${cl}${DS}:${cl}${sumR - 1})`, { border: THIN, fmt: CURR, bold: true, fill: YELLOW_FILL });
    }

    // ── Footer ──
    const endR = sumR + 1;
    ws.getCell(`${lastCol}${endR}`).value = '-끝-';
    ws.getCell(`${lastCol}${endR}`).font = { name: '굴림', size: 11 };
    ws.getCell(`${lastCol}${endR}`).alignment = { horizontal: 'right', vertical: 'middle' };

    // Signature block (끝 아래 2줄 여백 추가)
    const sigR = sumR + 5;
    const sigStart = colLetter(Math.max(1, totalCols - 3));

    ws.mergeCells(`${sigStart}${sigR}:${lastCol}${sigR}`);
    ws.getCell(`${sigStart}${sigR}`).value = doc.companyName;
    ws.getCell(`${sigStart}${sigR}`).font = { name: '굴림', size: 16, bold: true };
    ws.getCell(`${sigStart}${sigR}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells(`${sigStart}${sigR + 1}:${lastCol}${sigR + 1}`);
    ws.getCell(`${sigStart}${sigR + 1}`).value = doc.representative;
    ws.getCell(`${sigStart}${sigR + 1}`).font = { name: '굴림', size: 16, bold: true };
    ws.getCell(`${sigStart}${sigR + 1}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells(`${sigStart}${sigR + 2}:${lastCol}${sigR + 2}`);
    ws.getCell(`${sigStart}${sigR + 2}`).value = doc.sealText;
    ws.getCell(`${sigStart}${sigR + 2}`).font = { name: '굴림', size: 11 };
    ws.getCell(`${sigStart}${sigR + 2}`).alignment = { horizontal: 'right', vertical: 'middle' };
  }

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}
