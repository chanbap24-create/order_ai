import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

type TemplateKey = 'cdv1' | 'cdv2' | 'dl1' | 'dl2';

const TEMPLATE_FILES: Record<TemplateKey, string> = {
  cdv1: '영업1부_까브드뱅_와인_견적서.xlsx',
  cdv2: '영업2부_까브드뱅_와인_견적서.xlsx',
  dl1: '영업1부_대유라이프_글라스_견적서.xlsx',
  dl2: '영업2부_대유라이프_글라스_견적서.xlsx',
};

export async function GET(request: NextRequest) {
  try {
    ensureQuoteTable();
    const clientName = request.nextUrl.searchParams.get('client_name') || '';
    const templateKey = (request.nextUrl.searchParams.get('template') || 'cdv1') as TemplateKey;
    const items = db.prepare('SELECT * FROM quote_items ORDER BY id ASC').all() as any[];

    if (!['cdv1', 'cdv2', 'dl1', 'dl2'].includes(templateKey)) {
      return NextResponse.json({ error: '유효하지 않은 템플릿입니다.' }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    switch (templateKey) {
      case 'cdv1': await buildCDV1(workbook, items, clientName); break;
      case 'cdv2': await buildCDV2(workbook, items, clientName); break;
      case 'dl1':  await buildDL1(workbook, items, clientName); break;
      case 'dl2':  await buildDL2(workbook, items, clientName); break;
    }

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
// Shared helpers
// ═══════════════════════════════════════

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

// ── 템플릿에서 이미지 추출 후 삽입 ──
async function embedLogo(
  targetWb: ExcelJS.Workbook,
  targetWs: ExcelJS.Worksheet,
  templateKey: TemplateKey,
  imageRange: { tl: { col: number; row: number }; br: { col: number; row: number } }
): Promise<boolean> {
  const file = TEMPLATE_FILES[templateKey];
  const templatePath = path.join(process.cwd(), 'templates', file);
  if (!fs.existsSync(templatePath)) return false;

  try {
    const srcWb = new ExcelJS.Workbook();
    await srcWb.xlsx.readFile(templatePath);
    for (const srcWs of srcWb.worksheets) {
      const images = srcWs.getImages();
      if (images.length > 0) {
        const imgData = srcWb.getImage(images[0].imageId);
        if (imgData && imgData.buffer) {
          const imgId = targetWb.addImage({
            buffer: imgData.buffer as Buffer,
            extension: (imgData.extension || 'png') as 'png' | 'jpeg' | 'gif',
          });
          targetWs.addImage(imgId, imageRange);
          return true;
        }
      }
    }
  } catch (e) {
    console.error('Image embed error:', e);
  }
  return false;
}

// ═══════════════════════════════════════════════════
// CDV1: 영업1부 까브드뱅 와인 견적서
// - 2행/품목: 상단=영문명, 하단=한글명
// - VAT 별도, WON 기준
// ═══════════════════════════════════════════════════

async function buildCDV1(wb: ExcelJS.Workbook, items: any[], clientName: string) {
  const ws = wb.addWorksheet('까브드뱅 견적서');

  ws.columns = [
    { width: 5 },   // A: No.
    { width: 11 },  // B: 품목코드
    { width: 8 },   // C: 국가
    { width: 14 },  // D: 브랜드
    { width: 10 },  // E: 지역
    { width: 8 },   // F: 빈티지
    { width: 35 },  // G: 상품명
    { width: 12 },  // H: 공급가
    { width: 12 },  // I: 소비자가
    { width: 8 },   // J: 할인율
    { width: 12 },  // K: 할인가
    { width: 6 },   // L: 수량
    { width: 14 },  // M: 정상공급가합계
    { width: 14 },  // N: 할인공급가합계
    { width: 15 },  // O: 비고
    { width: 18 },  // P: 테이스팅노트
  ];

  // ── Header rows (with spacers) ──
  // Row 1: spacer
  ws.getRow(1).height = 8;

  // Row 2: Company name
  ws.mergeCells('A2:P2');
  const t2 = ws.getCell('A2');
  t2.value = '(주) 까 브 드 뱅';
  t2.font = { name: '굴림', size: 16, bold: true };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 30;

  // Row 3: Address
  ws.mergeCells('A3:P3');
  ws.getCell('A3').value = '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444';
  ws.getCell('A3').font = { name: '굴림', size: 8 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: spacer
  ws.getRow(4).height = 10;

  // Row 5: 수신 + date (right-aligned)
  ws.getCell('A5').value = `수      신 : ${clientName || ''}`;
  ws.getCell('A5').font = { name: '굴림', size: 11 };
  ws.mergeCells('O5:P5');
  ws.getCell('O5').value = fmtDate(new Date());
  ws.getCell('O5').font = { name: '굴림', size: 11 };
  ws.getCell('O5').alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 6: spacer
  ws.getRow(6).height = 8;

  // Row 7: 발신
  ws.getCell('A7').value = '발      신 : (주)까브드뱅';
  ws.getCell('A7').font = { name: '굴림', size: 11 };

  // Row 8: spacer
  ws.getRow(8).height = 8;

  // Row 9: 제목
  ws.getCell('A9').value = '제    목 : 와인 제안의 건';
  ws.getCell('A9').font = { name: '굴림', size: 11, bold: true };

  // Row 10: spacer
  ws.getRow(10).height = 8;

  // Row 11: 1. 귀사의...
  ws.getCell('A11').value = '1. 귀사의 일익 번창하심을 기원합니다.';
  ws.getCell('A11').font = { name: '굴림', size: 11 };

  // Row 12: spacer
  ws.getRow(12).height = 8;

  // Row 13: 2. 아래와같이...
  ws.getCell('A13').value = '2. 아래와 같이 와인 견적을 보내드리오니 검토하여 주시기 바랍니다.';
  ws.getCell('A13').font = { name: '굴림', size: 11 };

  // Row 14: spacer
  ws.getRow(14).height = 8;

  // Row 15: -아래-
  ws.mergeCells('A15:P15');
  ws.getCell('A15').value = '- 아         래 -';
  ws.getCell('A15').font = { name: '굴림', size: 11 };
  ws.getCell('A15').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 16: 제품 및 가격 + 단위
  ws.getCell('A16').value = '1. 제품 및 가격 :';
  ws.getCell('A16').font = { name: '굴림', size: 10 };
  ws.mergeCells('L16:P16');
  ws.getCell('L16').value = '단위 : VAT별도, WON, BTL.';
  ws.getCell('L16').font = { name: '굴림', size: 11, bold: true };
  ws.getCell('L16').alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell('L16').border = { bottom: { style: 'medium' } };

  // ── Column headers (Row 17) ──
  const hBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium' }, bottom: { style: 'double' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
  const hdrs = ['No.', '품목코드', '국가', '브랜드', '지역', '빈티지', '상품명',
    '공급가', '소비자가', '할인율', '할인가', '수량', '정상공급가\n합계', '할인공급가\n합계', '비고', '테이스팅노트'];
  const hRow = ws.getRow(17);
  hRow.height = 32;
  hdrs.forEach((h, i) => {
    sc(hRow, i + 1, h, { border: hBorder, fill: BLUE_FILL, bold: true, size: i >= 12 ? 8 : 10, wrap: true });
  });

  // ── Data rows (2 rows per item, starting row 18) ──
  const DS = 18;

  items.forEach((item: any, idx: number) => {
    const tr = DS + idx * 2;
    const br = tr + 1;
    ws.getRow(tr).height = 20;
    ws.getRow(br).height = 20;

    // Merge vertically: all columns except G (col 7 = 상품명)
    for (const c of [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      ws.mergeCells(tr, c, br, c);
    }

    sc(ws.getRow(tr), 1, idx + 1, { border: THIN });
    sc(ws.getRow(tr), 2, item.item_code || '', { border: THIN });
    sc(ws.getRow(tr), 3, item.country || '', { border: THIN });
    sc(ws.getRow(tr), 4, item.brand || '', { border: THIN, wrap: true, align: 'left' });
    sc(ws.getRow(tr), 5, item.region || '', { border: THIN });
    sc(ws.getRow(tr), 6, item.vintage || '', { border: THIN });

    // G: English name (top), Korean name (bottom)
    const topGBorder: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'hair' } };
    const botGBorder: Partial<ExcelJS.Borders> = { top: { style: 'hair' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    sc(ws.getRow(tr), 7, item.english_name || '', { border: topGBorder, align: 'left', size: 9 });
    sc(ws.getRow(br), 7, item.korean_name || item.product_name || '', { border: botGBorder, align: 'left', bold: true, size: 10 });

    sc(ws.getRow(tr), 8, item.supply_price || 0, { border: THIN, fmt: CURR });
    sc(ws.getRow(tr), 9, item.retail_price || 0, { border: THIN, fmt: CURR });
    sc(ws.getRow(tr), 10, item.discount_rate || 0, { border: THIN, fmt: PCT, color: 'FFFF0000' });
    sf(ws.getRow(tr), 11, `IFERROR(H${tr}*(1-J${tr}),"")`, { border: THIN, fmt: CURR, color: 'FFFF0000' });
    sc(ws.getRow(tr), 12, item.quantity || 0, { border: THIN });
    sf(ws.getRow(tr), 13, `IFERROR(H${tr}*L${tr},"")`, { border: THIN, fmt: CURR });
    sf(ws.getRow(tr), 14, `IFERROR(K${tr}*L${tr},"")`, { border: THIN, fmt: CURR, fill: YELLOW_FILL });
    sc(ws.getRow(tr), 15, item.note || '', { border: THIN, align: 'left', wrap: true, color: 'FFFF0000', bold: true, size: 9 });
    sc(ws.getRow(tr), 16, item.tasting_note || '', { border: THIN, align: 'left', wrap: true, size: 9 });
  });

  // ── Summary row ──
  if (items.length > 0) {
    const sumR = DS + items.length * 2;
    const lastTop = DS + (items.length - 1) * 2;
    const row = ws.getRow(sumR);
    row.height = 28;
    for (let c = 1; c <= 16; c++) {
      row.getCell(c).border = THIN;
      row.getCell(c).fill = YELLOW_FILL;
    }
    sc(row, 7, '합계', { border: THIN, fill: YELLOW_FILL, bold: true, size: 11 });
    sf(row, 13, `SUM(M${DS}:M${lastTop + 1})`, { border: THIN, fmt: CURR, bold: true, fill: YELLOW_FILL });
    sf(row, 14, `SUM(N${DS}:N${lastTop + 1})`, { border: THIN, fmt: CURR, bold: true, fill: YELLOW_FILL });

    // Footer (right-aligned)
    const endR = sumR + 1;
    ws.mergeCells(`O${endR}:P${endR}`);
    ws.getCell(`O${endR}`).value = '-끝-';
    ws.getCell(`O${endR}`).font = { name: '굴림', size: 11 };
    ws.getCell(`O${endR}`).alignment = { horizontal: 'right', vertical: 'middle' };

    const sigR = sumR + 3;
    ws.mergeCells(`K${sigR}:P${sigR}`);
    ws.getCell(`K${sigR}`).value = '(주) 까 브 드 뱅';
    ws.getCell(`K${sigR}`).font = { name: '굴림', size: 16, bold: true };
    ws.getCell(`K${sigR}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.mergeCells(`K${sigR + 1}:P${sigR + 1}`);
    ws.getCell(`K${sigR + 1}`).value = '대표이사 유병우';
    ws.getCell(`K${sigR + 1}`).font = { name: '굴림', size: 16, bold: true };
    ws.getCell(`K${sigR + 1}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.mergeCells(`K${sigR + 2}:P${sigR + 2}`);
    ws.getCell(`K${sigR + 2}`).value = '-직인생략-';
    ws.getCell(`K${sigR + 2}`).font = { name: '굴림', size: 11 };
    ws.getCell(`K${sigR + 2}`).alignment = { horizontal: 'right', vertical: 'middle' };
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ═══════════════════════════════════════════════════
// CDV2: 영업2부 까브드뱅 와인 견적서
// - 1행/품목, VAT 포함
// ═══════════════════════════════════════════════════

async function buildCDV2(wb: ExcelJS.Workbook, items: any[], clientName: string) {
  const ws = wb.addWorksheet('영업2부 견적서');

  ws.columns = [
    { width: 5 },   // A: 구분
    { width: 16 },  // B: 와이너리
    { width: 28 },  // C: 상품명
    { width: 8 },   // D: 국가
    { width: 6 },   // E: 본입
    { width: 8 },   // F: 종류
    { width: 14 },  // G: 권장소비자가
    { width: 14 },  // H: 제안가
    { width: 10 },  // I: 할인율
    { width: 15 },  // J: 비고
  ];

  // ── Header rows (with image + spacers) ──
  // Row 1: Logo image area
  ws.mergeCells('A1:J1');
  ws.getRow(1).height = 60;
  await embedLogo(wb, ws, 'cdv2', { tl: { col: 3, row: 0 }, br: { col: 7, row: 1 } });

  // Row 2: Address
  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = '서울시 영등포구 여의나루로 71, 동화빌딩 809호 / TEL: 02-780-9441 / FAX: 02-780-9444';
  ws.getCell('A2').font = { name: '굴림', size: 10 };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: Website
  ws.mergeCells('A3:J3');
  ws.getCell('A3').value = 'www.cavedevin.co.kr';
  ws.getCell('A3').font = { name: '돋움', size: 11, bold: true };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: spacer
  ws.getRow(4).height = 10;

  // Row 5: 수신 + date (right-aligned)
  ws.getCell('A5').value = `수      신 : ${clientName || ''}`;
  ws.getCell('A5').font = { name: '굴림', size: 11 };
  ws.getCell('J5').value = fmtDate(new Date());
  ws.getCell('J5').font = { name: '굴림', size: 11 };
  ws.getCell('J5').alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 6: spacer
  ws.getRow(6).height = 8;

  // Row 7: 발신
  ws.getCell('A7').value = '발      신 : (주)까브드뱅';
  ws.getCell('A7').font = { name: '굴림', size: 11 };

  // Row 8: spacer
  ws.getRow(8).height = 8;

  // Row 9: 제목
  ws.getCell('A9').value = '제      목 : 와인 견적서';
  ws.getCell('A9').font = { name: '굴림', size: 11, bold: true };

  // Row 10: spacer
  ws.getRow(10).height = 8;

  // Row 11: 1. 귀사의...
  ws.getCell('B11').value = '1. 귀사의 일익 번창하심을 기원합니다.';
  ws.getCell('B11').font = { name: '굴림', size: 11, bold: true };

  // Row 12: spacer
  ws.getRow(12).height = 8;

  // Row 13: 2. 아래와같이...
  ws.getCell('B13').value = '2. 아래와 같이 와인 견적서를 보내드리오니 검토하여 주시기 바랍니다.';
  ws.getCell('B13').font = { name: '굴림', size: 11, bold: true };

  // Row 14: spacer
  ws.getRow(14).height = 8;

  // Row 15: -아래-
  ws.mergeCells('A15:J15');
  ws.getCell('A15').value = '- 아         래 -';
  ws.getCell('A15').font = { name: '굴림', size: 11, bold: true };
  ws.getCell('A15').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 16: spacer
  ws.getRow(16).height = 8;

  // Row 17: 1) 견적 품목 + 단위
  ws.getCell('A17').value = '1) 견적 품목';
  ws.getCell('A17').font = { name: '굴림', size: 11, bold: true };
  ws.getCell('J17').value = '단위:원, %, Btl, VAT포함';
  ws.getCell('J17').font = { name: '굴림', size: 10 };
  ws.getCell('J17').alignment = { horizontal: 'right', vertical: 'middle' };

  // ── Column headers (Rows 18-19 merged vertically) ──
  const hBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'double' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
  const hdrs2 = ['구분', '와이너리', '상품명', '국가', '본입', '종류', '권장소비자가', '제안가', '할인율', '비고'];
  for (let c = 1; c <= 10; c++) {
    ws.mergeCells(18, c, 19, c);
  }
  const hRow2 = ws.getRow(18);
  hRow2.height = 28;
  ws.getRow(19).height = 28;
  hdrs2.forEach((h, i) => {
    sc(hRow2, i + 1, h, { border: hBorder, bold: i === 7 || i === 8, size: 10, wrap: true });
  });

  // ── Data rows (row 20+) ──
  const DS = 20;
  items.forEach((item: any, idx: number) => {
    const r = DS + idx;
    const row = ws.getRow(r);
    row.height = 50;

    sc(row, 1, idx + 1, { border: THIN });
    sc(row, 2, item.brand || '', { border: THIN, align: 'left', wrap: true });
    const pName = [item.english_name, item.korean_name || item.product_name].filter(Boolean).join('\n') || item.product_name || '';
    sc(row, 3, pName, { border: THIN, align: 'left', wrap: true, bold: true });
    sc(row, 4, item.country || '', { border: THIN });
    sc(row, 5, '', { border: THIN });
    sc(row, 6, '', { border: THIN });
    sc(row, 7, item.retail_price || 0, { border: THIN, fmt: CURR });
    const supplyPrice = Number(item.supply_price) || 0;
    const discRate = Number(item.discount_rate) || 0;
    const proposed = Math.round(supplyPrice * (1 - discRate));
    sc(row, 8, proposed, { border: THIN, fmt: CURR, bold: true });
    sf(row, 9, `IFERROR(1-H${r}/G${r},"")`, { border: THIN, fmt: PCT, bold: true });
    sc(row, 10, item.note || '', { border: THIN, align: 'left', wrap: true });
  });

  // ── Footer (right-aligned) ──
  if (items.length > 0) {
    const afterR = DS + items.length + 2;
    ws.getCell(`J${afterR}`).value = '-끝.-';
    ws.getCell(`J${afterR}`).font = { name: '굴림', size: 11 };
    ws.getCell(`J${afterR}`).alignment = { horizontal: 'right' };
    ws.getCell(`J${afterR + 1}`).value = '(주) 까 브 드 뱅';
    ws.getCell(`J${afterR + 1}`).font = { name: '굴림', size: 16 };
    ws.getCell(`J${afterR + 1}`).alignment = { horizontal: 'right' };
    ws.getCell(`J${afterR + 2}`).value = '대표이사 유병우';
    ws.getCell(`J${afterR + 2}`).font = { name: '굴림', size: 12 };
    ws.getCell(`J${afterR + 2}`).alignment = { horizontal: 'right' };
  }

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ═══════════════════════════════════════════════════
// DL1: 영업1부 대유라이프 글라스 견적서
// - 1행/품목, VAT 별도
// ═══════════════════════════════════════════════════

async function buildDL1(wb: ExcelJS.Workbook, items: any[], clientName: string) {
  const ws = wb.addWorksheet('리델견적서');

  ws.columns = [
    { width: 5 },   // A: 구분
    { width: 14 },  // B: 시리즈
    { width: 12 },  // C: 제품코드
    { width: 12 },  // D: 이미지
    { width: 28 },  // E: 품명
    { width: 14 },  // F: 정상공급가
    { width: 14 },  // G: 할인공급가
    { width: 8 },   // H: 할인율
    { width: 6 },   // I: 수량
    { width: 14 },  // J: 정상공급가합계
    { width: 14 },  // K: 할인공급가합계
    { width: 15 },  // L: 비고
  ];

  // ── Header rows (with image + spacers) ──
  // Row 1: Slogan
  ws.mergeCells('A1:L1');
  ws.getCell('A1').value = '고품격 삶의 질을 추구하는 Life Style Company';
  ws.getCell('A1').font = { name: '굴림', size: 9 };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2: Logo image
  ws.mergeCells('A2:L2');
  ws.getRow(2).height = 50;
  await embedLogo(wb, ws, 'dl1', { tl: { col: 3, row: 1 }, br: { col: 7, row: 2 } });

  // Row 3: Address
  ws.mergeCells('A3:L3');
  ws.getCell('A3').value = '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444';
  ws.getCell('A3').font = { name: '굴림', size: 7 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: Website
  ws.mergeCells('A4:L4');
  ws.getCell('A4').value = 'www.daeyulife.co.kr';
  ws.getCell('A4').font = { name: '돋움', size: 11 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 5: Date (right-aligned)
  ws.mergeCells('K5:L5');
  ws.getCell('K5').value = fmtDate(new Date());
  ws.getCell('K5').font = { name: '굴림', size: 11 };
  ws.getCell('K5').alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 6: 수신
  ws.getCell('A6').value = `수         신 : ${clientName || ''}`;
  ws.getCell('A6').font = { name: '굴림', size: 11 };

  // Row 7: spacer
  ws.getRow(7).height = 8;

  // Row 8: 발신
  ws.getCell('A8').value = '발         신 : 대유라이프 주식회사';
  ws.getCell('A8').font = { name: '굴림', size: 11 };

  // Row 9: spacer
  ws.getRow(9).height = 8;

  // Row 10: 제목
  ws.getCell('A10').value = '제         목 : 리델글라스 견적의 건';
  ws.getCell('A10').font = { name: '굴림', size: 11 };

  // Row 11: spacer
  ws.getRow(11).height = 8;

  // Row 12: 1. 귀사의...
  ws.getCell('A12').value = '1. 귀사의 일익 번창하심을 기원합니다.';
  ws.getCell('A12').font = { name: '굴림', size: 11 };

  // Row 13: spacer
  ws.getRow(13).height = 8;

  // Row 14: 2. 아래와같이...
  ws.getCell('A14').value = '2. 아래와 같이 리델글라스 견적을 보내드리오니 검토하여 주시기 바랍니다.';
  ws.getCell('A14').font = { name: '굴림', size: 11 };

  // Row 15: spacer
  ws.getRow(15).height = 8;

  // Row 16: -아래-
  ws.mergeCells('A16:L16');
  ws.getCell('A16').value = '-           아            래            -';
  ws.getCell('A16').font = { name: '굴림', size: 11 };
  ws.getCell('A16').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 17: 단위
  ws.getCell('L17').value = '단위 : 원, ea, %, VAT별도';
  ws.getCell('L17').font = { name: '굴림', size: 11 };
  ws.getCell('L17').alignment = { horizontal: 'right', vertical: 'middle' };

  // ── Column headers (Row 18) ──
  const hdrs3 = ['구분', '시리즈', '제품코드', '이미지', '품명', '정상공급가', '할인공급가', '할인율', '수량', '정상공급가\n합계', '할인공급가\n합계', '비고'];
  const hRow3 = ws.getRow(18);
  hRow3.height = 34;
  hdrs3.forEach((h, i) => {
    sc(hRow3, i + 1, h, { border: THIN, fill: BLUE_FILL, bold: false, size: 10, wrap: true });
  });

  // ── Data rows (row 19+) ──
  const DS = 19;
  items.forEach((item: any, idx: number) => {
    const r = DS + idx;
    const row = ws.getRow(r);
    row.height = 50;

    sc(row, 1, idx + 1, { border: THIN });
    sc(row, 2, item.brand || '', { border: THIN, align: 'left', wrap: true });
    sc(row, 3, item.item_code || '', { border: THIN });
    sc(row, 4, item.image_url || '', { border: THIN, align: 'left' });
    sc(row, 5, item.product_name || '', { border: THIN, align: 'left', wrap: true });
    sc(row, 6, item.supply_price || 0, { border: THIN, fmt: CURR });
    sf(row, 7, `IFERROR(F${r}*(1-H${r}),"")`, { border: THIN, fmt: CURR });
    sc(row, 8, item.discount_rate || 0, { border: THIN, fmt: PCT });
    sc(row, 9, item.quantity || 0, { border: THIN });
    sf(row, 10, `IFERROR(F${r}*I${r},"")`, { border: THIN, fmt: CURR });
    sf(row, 11, `IFERROR(G${r}*I${r},"")`, { border: THIN, fmt: CURR });
    sc(row, 12, item.note || '', { border: THIN, align: 'left', wrap: true });
  });

  // ── Summary + VAT ──
  if (items.length > 0) {
    const sumR = DS + items.length;
    const lastR = sumR - 1;
    const row = ws.getRow(sumR);
    row.height = 28;
    ws.mergeCells(`B${sumR}:E${sumR}`);
    sc(row, 1, '', { border: THIN });
    sc(row, 2, '합     계', { border: THIN, bold: true });
    for (let c = 6; c <= 12; c++) row.getCell(c).border = THIN;
    sf(row, 10, `SUM(J${DS}:J${lastR})`, { border: THIN, fmt: CURR, bold: true });
    sf(row, 11, `SUM(K${DS}:K${lastR})`, { border: THIN, fmt: CURR, bold: true });

    // VAT row
    const vatR = sumR + 1;
    const vatRow = ws.getRow(vatR);
    sc(vatRow, 1, '', { border: THIN });
    ws.mergeCells(`B${vatR}:E${vatR}`);
    sc(vatRow, 2, '* 부가세 포함', { border: THIN, color: 'FFFF0000', bold: true, align: 'left' });
    for (let c = 6; c <= 12; c++) vatRow.getCell(c).border = THIN;
    sf(vatRow, 11, `K${sumR}*1.1`, { border: THIN, fmt: CURR, bold: true });

    // Footer (right-aligned)
    ws.getCell(`L${vatR}`).value = '-끝.-';
    ws.getCell(`L${vatR}`).font = { name: '굴림', size: 11 };
    ws.getCell(`L${vatR}`).alignment = { horizontal: 'right' };
    ws.getCell(`L${vatR + 1}`).value = '대유라이프 주식회사';
    ws.getCell(`L${vatR + 1}`).font = { name: '굴림', size: 16 };
    ws.getCell(`L${vatR + 1}`).alignment = { horizontal: 'right' };
    ws.getCell(`L${vatR + 2}`).value = '대표이사  유 병 우';
    ws.getCell(`L${vatR + 2}`).font = { name: '굴림', size: 16 };
    ws.getCell(`L${vatR + 2}`).alignment = { horizontal: 'right' };
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ═══════════════════════════════════════════════════
// DL2: 영업2부 대유라이프 글라스 견적서
// - 1행/품목, 공급가 VAT 별도
// ═══════════════════════════════════════════════════

async function buildDL2(wb: ExcelJS.Workbook, items: any[], clientName: string) {
  const ws = wb.addWorksheet('글라스 견적서');

  ws.columns = [
    { width: 5 },   // A: 구분
    { width: 30 },  // B: 상품명
    { width: 10 },  // C: 원산지
    { width: 12 },  // D: 생산 방법
    { width: 8 },   // E: BOX 본입수
    { width: 12 },  // F: 공급가
    { width: 6 },   // G: 수량
    { width: 14 },  // H: 합계
    { width: 15 },  // I: 비고
  ];

  // ── Header rows (with image + spacers) ──
  // Row 1: Logo image area
  ws.mergeCells('A1:I1');
  ws.getRow(1).height = 80;
  await embedLogo(wb, ws, 'dl2', { tl: { col: 2, row: 0 }, br: { col: 6, row: 1 } });

  // Row 2: Address
  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = '서울시 영등포구 여의나루로 71, 동화빌딩 810호 / TEL: 02-780-9441 / FAX: 02-780-9444';
  ws.getCell('A2').font = { name: '굴림', size: 10 };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: Website
  ws.mergeCells('A3:I3');
  ws.getCell('A3').value = 'www.daeyulife.co.kr';
  ws.getCell('A3').font = { name: '돋움', size: 11 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: spacer
  ws.getRow(4).height = 10;

  // Row 5: 수신 + date (right-aligned)
  ws.getCell('A5').value = `수      신 : ${clientName || ''}`;
  ws.getCell('A5').font = { name: '굴림', size: 11 };
  ws.getCell('I5').value = fmtDate(new Date());
  ws.getCell('I5').font = { name: '굴림', size: 11 };
  ws.getCell('I5').alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 6: spacer
  ws.getRow(6).height = 8;

  // Row 7: 발신
  ws.getCell('A7').value = '발      신 : 대유라이프(주)';
  ws.getCell('A7').font = { name: '굴림', size: 11 };

  // Row 8: spacer
  ws.getRow(8).height = 8;

  // Row 9: 제목
  ws.getCell('A9').value = '제      목 : 리델글라스 상품 견적서';
  ws.getCell('A9').font = { name: '굴림', size: 11, bold: true };

  // Row 10: spacer
  ws.getRow(10).height = 8;

  // Row 11: 1. 귀사의...
  ws.getCell('B11').value = '1. 귀사의 일익 번창하심을 기원합니다.';
  ws.getCell('B11').font = { name: '굴림', size: 11, bold: true };

  // Row 12: spacer
  ws.getRow(12).height = 8;

  // Row 13: 2. 아래와같이...
  ws.getCell('B13').value = '2. 아래와 같이 와인 글라스를 제안드리오니 검토하여 주시기 바랍니다.';
  ws.getCell('B13').font = { name: '굴림', size: 11, bold: true };

  // Row 14: spacer
  ws.getRow(14).height = 8;

  // Row 15: -아래-
  ws.mergeCells('A15:I15');
  ws.getCell('A15').value = '- 아         래 -';
  ws.getCell('A15').font = { name: '굴림', size: 11 };
  ws.getCell('A15').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 16: 제안처 + 제안 품목 + 단위
  ws.getCell('A16').value = `1. 제안처: ${clientName || ''}`;
  ws.getCell('A16').font = { name: '굴림', size: 11 };

  // Row 17: 제안 품목 + 단위
  ws.getCell('A17').value = '2. 제안 품목';
  ws.getCell('A17').font = { name: '굴림', size: 11 };
  ws.getCell('I17').value = '단위: 원, ea, %, 공급가VAT 별도';
  ws.getCell('I17').font = { name: '굴림', size: 10 };
  ws.getCell('I17').alignment = { horizontal: 'right', vertical: 'middle' };

  // ── Column headers (Rows 18-19 merged vertically) ──
  const hdrs4 = ['구분', '상품명', '원산지', '생산 방법', 'BOX\n본입수', '공급가', '수량', '합계', '비고'];
  for (let c = 1; c <= 9; c++) {
    ws.mergeCells(18, c, 19, c);
  }
  const hRow4 = ws.getRow(18);
  hRow4.height = 27;
  ws.getRow(19).height = 27;
  hdrs4.forEach((h, i) => {
    sc(hRow4, i + 1, h, { border: THIN, bold: true, size: 10, wrap: true });
  });

  // ── Data rows (row 20+) ──
  const DS = 20;
  items.forEach((item: any, idx: number) => {
    const r = DS + idx;
    const row = ws.getRow(r);
    row.height = 42;

    sc(row, 1, idx + 1, { border: THIN, bold: true });
    sc(row, 2, item.product_name || '', { border: THIN, align: 'left', bold: true, wrap: true });
    sc(row, 3, item.country || '', { border: THIN, bold: true });
    sc(row, 4, '', { border: THIN, bold: true });
    sc(row, 5, '', { border: THIN, bold: true });
    sc(row, 6, item.supply_price || 0, { border: THIN, fmt: CURR, bold: true });
    sc(row, 7, item.quantity || 0, { border: THIN, bold: true });
    sf(row, 8, `IFERROR(F${r}*G${r},"")`, { border: THIN, fmt: CURR, bold: true });
    sc(row, 9, item.note || '', { border: THIN, align: 'left', bold: true, wrap: true });
  });

  // ── Summary ──
  if (items.length > 0) {
    const sumR = DS + items.length;
    const lastR = sumR - 1;
    const row = ws.getRow(sumR);
    row.height = 28;
    ws.mergeCells(`A${sumR}:F${sumR}`);
    sc(row, 1, '합    계', { border: THIN, bold: true });
    sf(row, 7, `SUM(G${DS}:G${lastR})`, { border: THIN, bold: true });
    sf(row, 8, `SUM(H${DS}:H${lastR})`, { border: THIN, fmt: CURR, bold: true });
    sc(row, 9, '', { border: THIN });

    // Warnings
    const warnR = sumR + 1;
    ws.mergeCells(`A${warnR}:I${warnR}`);
    ws.getCell(`A${warnR}`).value = '** 제안 제품은 증정용, 업소용 제품으로 소비자 판매는 불가합니다.';
    ws.getCell(`A${warnR}`).font = { name: '굴림', size: 10, bold: true, color: { argb: 'FFFF0000' } };
    ws.mergeCells(`A${warnR + 1}:I${warnR + 1}`);
    ws.getCell(`A${warnR + 1}`).value = '** 상품과 함께 지원 드리는 리델 종이케이스 외 리델 제품 보증카드가 기본 동봉됩니다.';
    ws.getCell(`A${warnR + 1}`).font = { name: '굴림', size: 10, bold: true, color: { argb: 'FFFF0000' } };

    // Footer (right-aligned)
    const sigR = warnR + 4;
    ws.getCell(`I${sigR}`).value = '대 유 라 이 프(주)';
    ws.getCell(`I${sigR}`).font = { name: '굴림', size: 18, bold: true };
    ws.getCell(`I${sigR}`).alignment = { horizontal: 'right' };
    ws.getCell(`I${sigR + 1}`).value = '대표이사 유병우';
    ws.getCell(`I${sigR + 1}`).font = { name: '굴림', size: 12, bold: true };
    ws.getCell(`I${sigR + 1}`).alignment = { horizontal: 'right' };
    ws.getCell(`I${sigR + 2}`).value = '-직인 생략-';
    ws.getCell(`I${sigR + 2}`).font = { name: '굴림', size: 10 };
    ws.getCell(`I${sigR + 2}`).alignment = { horizontal: 'right' };
  }

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}
