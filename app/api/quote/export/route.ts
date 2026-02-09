import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

interface DocSettings {
  companyName: string;
  address: string;
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
  type: 'index' | 'text' | 'currency' | 'percent' | 'number' | 'formula' | 'link';
  dataField?: string;
}

const ALL_EXCEL_COLUMNS: ColDef[] = [
  { uiKey: null, label: 'No.', width: 5, type: 'index' },
  { uiKey: 'item_code', label: '품목코드', width: 11, type: 'text', dataField: 'item_code' },
  { uiKey: 'country', label: '국가', width: 8, type: 'text', dataField: 'country' },
  { uiKey: 'brand', label: '브랜드', width: 14, type: 'text', dataField: 'brand' },
  { uiKey: 'region', label: '지역', width: 10, type: 'text', dataField: 'region' },
  { uiKey: 'image_url', label: '이미지', width: 12, type: 'text', dataField: 'image_url' },
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
  { uiKey: 'note', label: '비고', width: 15, type: 'text', dataField: 'note' },
  { uiKey: 'tasting_note', label: '테이스팅노트', width: 18, type: 'link' },
];

const DEFAULT_DOC: DocSettings = {
  companyName: '(주) 까 브 드 뱅',
  address: '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444',
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
    const clientName = request.nextUrl.searchParams.get('client_name') || '';
    const items = db.prepare('SELECT * FROM quote_items ORDER BY id ASC').all() as any[];

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

    // Filter active columns based on visibility
    const activeCols = ALL_EXCEL_COLUMNS.filter(
      c => c.uiKey === null || visibleColumns.includes(c.uiKey)
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    buildQuote(workbook, items, clientName, activeCols, docSettings);

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
  doc: DocSettings
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
  ws.getRow(1).height = 8;

  // Row 2: Company name
  ws.mergeCells(`A2:${lastCol}2`);
  const titleCell = ws.getCell('A2');
  titleCell.value = doc.companyName;
  titleCell.font = { name: '굴림', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 30;

  // Row 3: Address
  ws.mergeCells(`A3:${lastCol}3`);
  ws.getCell('A3').value = doc.address;
  ws.getCell('A3').font = { name: '굴림', size: 8 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: spacer
  ws.getRow(4).height = 10;

  // Row 5: 수신 + date
  ws.getCell('A5').value = `수      신 : ${clientName || ''}`;
  ws.getCell('A5').font = { name: '굴림', size: 11 };
  ws.getCell(`${lastCol}5`).value = fmtDate(new Date());
  ws.getCell(`${lastCol}5`).font = { name: '굴림', size: 11 };
  ws.getCell(`${lastCol}5`).alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 6: spacer
  ws.getRow(6).height = 8;

  // Row 7: 발신
  ws.getCell('A7').value = `발      신 : ${doc.sender}`;
  ws.getCell('A7').font = { name: '굴림', size: 11 };

  // Row 8: spacer
  ws.getRow(8).height = 8;

  // Row 9: 제목
  ws.getCell('A9').value = `제    목 : ${doc.title}`;
  ws.getCell('A9').font = { name: '굴림', size: 11, bold: true };

  // Row 10: spacer
  ws.getRow(10).height = 8;

  // Row 11: 내용 1
  ws.getCell('A11').value = doc.content1;
  ws.getCell('A11').font = { name: '굴림', size: 11 };

  // Row 12: spacer
  ws.getRow(12).height = 8;

  // Row 13: 내용 2
  ws.getCell('A13').value = doc.content2;
  ws.getCell('A13').font = { name: '굴림', size: 11 };

  // Row 14: spacer
  ws.getRow(14).height = 8;

  // Row 15: 내용 3 (centered)
  ws.mergeCells(`A15:${lastCol}15`);
  ws.getCell('A15').value = doc.content3;
  ws.getCell('A15').font = { name: '굴림', size: 11 };
  ws.getCell('A15').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 16: 제품 및 가격 + 단위
  ws.getCell('A16').value = '1. 제품 및 가격 :';
  ws.getCell('A16').font = { name: '굴림', size: 10 };
  const unitStartCol = colLetter(Math.max(1, totalCols - 2));
  if (totalCols > 3) {
    ws.mergeCells(`${unitStartCol}16:${lastCol}16`);
  }
  ws.getCell(`${unitStartCol}16`).value = doc.unit;
  ws.getCell(`${unitStartCol}16`).font = { name: '굴림', size: 11, bold: true };
  ws.getCell(`${unitStartCol}16`).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(`${unitStartCol}16`).border = { bottom: { style: 'medium' } };

  // ── Column headers (Row 17) ──
  const hBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium' }, bottom: { style: 'double' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
  const hRow = ws.getRow(17);
  hRow.height = 32;
  activeCols.forEach((col, i) => {
    sc(hRow, i + 1, col.label, { border: hBorder, fill: BLUE_FILL, bold: true, size: 10, wrap: true });
  });

  // ── Data rows (Row 18+) ──
  const DS = 18;

  items.forEach((item: any, idx: number) => {
    const r = DS + idx;
    const row = ws.getRow(r);
    row.height = 24;

    activeCols.forEach((col, ci) => {
      const c = ci + 1;

      // No.
      if (col.type === 'index') {
        sc(row, c, idx + 1, { border: THIN });
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
          const pdfUrl = `${TASTING_NOTE_BASE_URL}/${itemCode}.pdf`;
          const cell = row.getCell(c);
          cell.value = { text: '테이스팅노트', hyperlink: pdfUrl } as ExcelJS.CellHyperlinkValue;
          cell.font = { name: '굴림', size: 9, color: { argb: 'FF0563C1' }, underline: true };
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
        sc(row, c, Number(val) || 0, { border: THIN, fmt: PCT, color: 'FFFF0000' });
      } else if (col.type === 'number') {
        sc(row, c, Number(val) || 0, { border: THIN });
      } else {
        const leftAlign = ['product_name', 'english_name', 'korean_name', 'brand', 'note', 'tasting_note', 'region', 'image_url'].includes(col.uiKey || '');
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

    // Signature block
    const sigR = sumR + 3;
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

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}
