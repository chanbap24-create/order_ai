import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

// 템플릿 정의
type TemplateKey = 'cdv1' | 'cdv2' | 'dl1' | 'dl2';

const TEMPLATES: Record<TemplateKey, { file: string; label: string; sheetName: string; headerRow: number; dataStartRow: number }> = {
  cdv1: { file: '영업1부_까브드뱅_와인_견적서.xlsx', label: '영업1부 와인', sheetName: '영업1부_견적서', headerRow: 12, dataStartRow: 13 },
  cdv2: { file: '영업2부_까브드뱅_와인_견적서.xlsx', label: '영업2부 와인', sheetName: '230921 (2)', headerRow: 12, dataStartRow: 14 },
  dl1:  { file: '영업1부_대유라이프_글라스_견적서.xlsx', label: '영업1부 글라스', sheetName: '대유라이프_글라스', headerRow: 13, dataStartRow: 14 },
  dl2:  { file: '영업2부_대유라이프_글라스_견적서.xlsx', label: '영업2부 글라스', sheetName: 'list', headerRow: 12, dataStartRow: 14 },
};

export async function GET(request: NextRequest) {
  try {
    ensureQuoteTable();

    const clientName = request.nextUrl.searchParams.get('client_name') || '';
    const templateKey = (request.nextUrl.searchParams.get('template') || 'cdv1') as TemplateKey;
    const items = db.prepare('SELECT * FROM quote_items ORDER BY id ASC').all() as any[];

    // 템플릿이 유효한지 확인
    const tmpl = TEMPLATES[templateKey];
    if (!tmpl) {
      return NextResponse.json({ error: '유효하지 않은 템플릿입니다.' }, { status: 400 });
    }

    // 템플릿 파일 로드 시도
    const templatePath = path.join(process.cwd(), 'templates', tmpl.file);
    let workbook: ExcelJS.Workbook;
    let sheet: ExcelJS.Worksheet;
    let useTemplate = false;

    if (fs.existsSync(templatePath)) {
      // 템플릿 파일 기반 생성
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);
      const foundSheet = workbook.getWorksheet(tmpl.sheetName) || workbook.worksheets[0];
      if (foundSheet) {
        sheet = foundSheet;
        useTemplate = true;
      } else {
        // 시트를 못 찾으면 새로 생성
        sheet = workbook.addWorksheet('견적서');
      }
    } else {
      // 템플릿 없으면 새로 생성 (폴백)
      workbook = new ExcelJS.Workbook();
      sheet = workbook.addWorksheet('견적서');
    }

    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    const currencyFormat = '#,##0';
    const percentFormat = '0%';

    if (useTemplate) {
      // ── 템플릿 기반 데이터 삽입 ──
      writeTemplateData(sheet, items, templateKey, tmpl, clientName, thinBorder, currencyFormat, percentFormat);
    } else {
      // ── 폴백: 자체 생성 ──
      writeFallbackSheet(sheet, items, clientName, thinBorder, currencyFormat, percentFormat);
    }

    // ── 파일 생성 및 응답 ──
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

// ── 템플릿 기반 데이터 삽입 ──
function writeTemplateData(
  sheet: ExcelJS.Worksheet,
  items: any[],
  templateKey: TemplateKey,
  tmpl: typeof TEMPLATES[TemplateKey],
  clientName: string,
  border: Partial<ExcelJS.Borders>,
  currFmt: string,
  pctFmt: string,
) {
  const dataStart = tmpl.dataStartRow;

  // 기존 샘플 데이터 행 클리어 (헤더 아래부터 넉넉히)
  for (let r = dataStart; r <= dataStart + 30; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.type !== ExcelJS.ValueType.Merge) {
        cell.value = null;
      }
    });
  }

  switch (templateKey) {
    case 'cdv1':
      writeCDV1(sheet, items, dataStart, border, currFmt, pctFmt);
      break;
    case 'cdv2':
      writeCDV2(sheet, items, dataStart, clientName, border, currFmt, pctFmt);
      break;
    case 'dl1':
      writeDL1(sheet, items, dataStart, border, currFmt, pctFmt);
      break;
    case 'dl2':
      writeDL2(sheet, items, dataStart, border, currFmt);
      break;
  }
}

// ═══ 영업1부 와인 (cdv1) ═══
// 헤더 row 12: 번호|코드|품명|규격|수량|이미지|멀티셋|상품설명(H-L)|공급가(M)|할인율(O)|할인가(Q)|수량(S)|공급가합계(U)|할인가합계(W)|비고(Y)
function writeCDV1(sheet: ExcelJS.Worksheet, items: any[], startRow: number, border: Partial<ExcelJS.Borders>, currFmt: string, pctFmt: string) {
  items.forEach((item: any, idx: number) => {
    const r = startRow + idx;
    const row = sheet.getRow(r);

    setCellVal(row, 1, idx + 1, border);                         // A: 번호
    setCellVal(row, 2, item.item_code || '', border);             // B: 코드
    setCellVal(row, 3, item.product_name || '', border);          // C: 품명
    setCellVal(row, 4, item.vintage || '', border);               // D: 규격
    setCellVal(row, 5, item.quantity || 0, border);               // E: 수량
    setCellVal(row, 6, item.image_url || '', border);             // F: 이미지
    setCellVal(row, 7, '', border);                               // G: 멀티셋
    setCellVal(row, 8, item.country || '', border);               // H: 상품설명 영역
    setCellVal(row, 13, item.supply_price || 0, border, currFmt); // M: 공급가
    setCellVal(row, 15, item.discount_rate || 0, border, pctFmt); // O: 할인율
    // Q: 할인가 (수식)
    const cellQ = row.getCell(17);
    cellQ.value = { formula: `IFERROR(M${r}*(1-O${r}),"")` } as ExcelJS.CellFormulaValue;
    cellQ.numFmt = currFmt;
    cellQ.border = border;
    // S: 수량
    setCellVal(row, 19, item.quantity || 0, border);
    // U: 공급가합계 (수식)
    const cellU = row.getCell(21);
    cellU.value = { formula: `IFERROR(M${r}*S${r},"")` } as ExcelJS.CellFormulaValue;
    cellU.numFmt = currFmt;
    cellU.border = border;
    // W: 할인가합계 (수식)
    const cellW = row.getCell(23);
    cellW.value = { formula: `IFERROR(Q${r}*S${r},"")` } as ExcelJS.CellFormulaValue;
    cellW.numFmt = currFmt;
    cellW.border = border;
    // Y: 비고
    setCellVal(row, 25, item.note || '', border);
  });

  // 합계행
  if (items.length > 0) {
    const totalR = startRow + items.length;
    const lastR = totalR - 1;
    const row = sheet.getRow(totalR);
    setCellVal(row, 3, '합계', border);
    const tU = row.getCell(21);
    tU.value = { formula: `SUM(U${startRow}:U${lastR})` } as ExcelJS.CellFormulaValue;
    tU.numFmt = currFmt; tU.border = border; tU.font = { bold: true };
    const tW = row.getCell(23);
    tW.value = { formula: `SUM(W${startRow}:W${lastR})` } as ExcelJS.CellFormulaValue;
    tW.numFmt = currFmt; tW.border = border; tW.font = { bold: true };
  }
}

// ═══ 영업2부 와인 (cdv2) ═══
// 헤더 row 12: 번호(A)|와인라인명(B)|상품명(C)|분류(D)|수량(E)|원산지(F)|소비자가(G)|할인가격(H)|할인율(I)|비고(J)
function writeCDV2(sheet: ExcelJS.Worksheet, items: any[], startRow: number, clientName: string, border: Partial<ExcelJS.Borders>, currFmt: string, pctFmt: string) {
  items.forEach((item: any, idx: number) => {
    const r = startRow + idx;
    const row = sheet.getRow(r);

    setCellVal(row, 1, idx + 1, border);                         // A: 번호
    setCellVal(row, 2, item.brand || '', border);                 // B: 와인라인명
    setCellVal(row, 3, item.product_name || '', border);          // C: 상품명
    setCellVal(row, 4, item.country || '', border);               // D: 분류
    setCellVal(row, 5, item.quantity || 0, border);               // E: 수량
    setCellVal(row, 6, item.region || '', border);                // F: 원산지
    setCellVal(row, 7, item.retail_price || 0, border, currFmt);  // G: 소비자가
    // H: 할인가격 = 공급가 (할인 적용된 가격)
    const supplyPrice = Number(item.supply_price) || 0;
    const discRate = Number(item.discount_rate) || 0;
    const discounted = Math.round(supplyPrice * (1 - discRate));
    setCellVal(row, 8, discounted, border, currFmt);
    // I: 할인율 (수식: 1 - H/G)
    const cellI = row.getCell(9);
    cellI.value = { formula: `IFERROR(1-H${r}/G${r},"")` } as ExcelJS.CellFormulaValue;
    cellI.numFmt = pctFmt;
    cellI.border = border;
    // J: 비고
    setCellVal(row, 10, item.note || '', border);
  });
}

// ═══ 영업1부 글라스 (dl1) ═══
// 헤더 row 13: 번호(A)|종류별(B)|상품코드(C)|이미지(D)|상품명(E)|공급가격(F)|할인가격(G)|할인율(H)|수량(I)|공급가합계(J)|할인가합계(K)|비고(L)
function writeDL1(sheet: ExcelJS.Worksheet, items: any[], startRow: number, border: Partial<ExcelJS.Borders>, currFmt: string, pctFmt: string) {
  items.forEach((item: any, idx: number) => {
    const r = startRow + idx;
    const row = sheet.getRow(r);

    setCellVal(row, 1, idx + 1, border);                         // A: 번호
    setCellVal(row, 2, item.brand || '', border);                 // B: 종류별
    setCellVal(row, 3, item.item_code || '', border);             // C: 상품코드
    setCellVal(row, 4, item.image_url || '', border);             // D: 이미지
    setCellVal(row, 5, item.product_name || '', border);          // E: 상품명
    setCellVal(row, 6, item.supply_price || 0, border, currFmt);  // F: 공급가격
    // G: 할인가격 (수식)
    const cellG = row.getCell(7);
    cellG.value = { formula: `IFERROR(F${r}*(1-H${r}),"")` } as ExcelJS.CellFormulaValue;
    cellG.numFmt = currFmt; cellG.border = border;
    // H: 할인율
    setCellVal(row, 8, item.discount_rate || 0, border, pctFmt);
    // I: 수량
    setCellVal(row, 9, item.quantity || 0, border);
    // J: 공급가합계 (수식)
    const cellJ = row.getCell(10);
    cellJ.value = { formula: `IFERROR(F${r}*I${r},"")` } as ExcelJS.CellFormulaValue;
    cellJ.numFmt = currFmt; cellJ.border = border;
    // K: 할인가합계 (수식)
    const cellK = row.getCell(11);
    cellK.value = { formula: `IFERROR(G${r}*I${r},"")` } as ExcelJS.CellFormulaValue;
    cellK.numFmt = currFmt; cellK.border = border;
    // L: 비고
    setCellVal(row, 12, item.note || '', border);
  });

  // 합계행 + VAT행
  if (items.length > 0) {
    const totalR = startRow + items.length;
    const lastR = totalR - 1;
    const row = sheet.getRow(totalR);
    setCellVal(row, 5, '소계', border);
    const tJ = row.getCell(10);
    tJ.value = { formula: `SUM(J${startRow}:J${lastR})` } as ExcelJS.CellFormulaValue;
    tJ.numFmt = currFmt; tJ.border = border; tJ.font = { bold: true };
    const tK = row.getCell(11);
    tK.value = { formula: `SUM(K${startRow}:K${lastR})` } as ExcelJS.CellFormulaValue;
    tK.numFmt = currFmt; tK.border = border; tK.font = { bold: true };

    // VAT행
    const vatR = totalR + 1;
    const vatRow = sheet.getRow(vatR);
    setCellVal(vatRow, 5, 'VAT 포함', border);
    const vatK = vatRow.getCell(11);
    vatK.value = { formula: `K${totalR}*1.1` } as ExcelJS.CellFormulaValue;
    vatK.numFmt = currFmt; vatK.border = border; vatK.font = { bold: true };
  }
}

// ═══ 영업2부 글라스 (dl2) ═══
// 헤더 row 12: 번호(A)|상품명(B)|카테고리(C)|규격(D)|BOX(E)|공급가(F)|수량(G)|합계(H)|비고(I)
function writeDL2(sheet: ExcelJS.Worksheet, items: any[], startRow: number, border: Partial<ExcelJS.Borders>, currFmt: string) {
  items.forEach((item: any, idx: number) => {
    const r = startRow + idx;
    const row = sheet.getRow(r);

    setCellVal(row, 1, idx + 1, border);                         // A: 번호
    setCellVal(row, 2, item.product_name || '', border);          // B: 상품명
    setCellVal(row, 3, item.brand || '', border);                 // C: 카테고리
    setCellVal(row, 4, item.vintage || '', border);               // D: 규격
    setCellVal(row, 5, '', border);                               // E: BOX
    setCellVal(row, 6, item.supply_price || 0, border, currFmt);  // F: 공급가
    setCellVal(row, 7, item.quantity || 0, border);               // G: 수량
    // H: 합계 (수식)
    const cellH = row.getCell(8);
    cellH.value = { formula: `IFERROR(F${r}*G${r},"")` } as ExcelJS.CellFormulaValue;
    cellH.numFmt = currFmt; cellH.border = border;
    // I: 비고
    setCellVal(row, 9, item.note || '', border);
  });

  // 합계행
  if (items.length > 0) {
    const totalR = startRow + items.length;
    const lastR = totalR - 1;
    const row = sheet.getRow(totalR);
    setCellVal(row, 2, '합계', border);
    row.getCell(2).font = { bold: true };
    const tG = row.getCell(7);
    tG.value = { formula: `SUM(G${startRow}:G${lastR})` } as ExcelJS.CellFormulaValue;
    tG.border = border; tG.font = { bold: true };
    const tH = row.getCell(8);
    tH.value = { formula: `SUM(H${startRow}:H${lastR})` } as ExcelJS.CellFormulaValue;
    tH.numFmt = currFmt; tH.border = border; tH.font = { bold: true };
  }
}

// ── 폴백: 템플릿 없을 때 자체 생성 ──
function writeFallbackSheet(
  sheet: ExcelJS.Worksheet,
  items: any[],
  clientName: string,
  border: Partial<ExcelJS.Borders>,
  currFmt: string,
  pctFmt: string,
) {
  sheet.columns = [
    { width: 5 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 10 },
    { width: 20 }, { width: 8 }, { width: 30 }, { width: 12 }, { width: 12 },
    { width: 8 }, { width: 12 }, { width: 6 }, { width: 14 }, { width: 14 },
    { width: 15 }, { width: 20 },
  ];

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAF8' } };
  const totalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  // 헤더
  sheet.mergeCells('A1:Q1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Cave De Vin 견적서';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF8B1538' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 36;

  sheet.mergeCells('A2:Q2');
  const infoCell = sheet.getCell('A2');
  infoCell.value = clientName
    ? `거래처: ${clientName}  |  작성일: ${formatDate(new Date())}  |  VAT 별도  |  WON 기준`
    : `작성일: ${formatDate(new Date())}  |  VAT 별도  |  WON 기준`;
  infoCell.font = { size: 10, color: { argb: 'FF666666' } };
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.getRow(4).height = 8;

  const headers = [
    'No.', '품목코드', '국가', '브랜드', '지역', '이미지', '빈티지',
    '상품명', '공급가', '소비자가', '할인율', '할인가', '수량',
    '정상공급가합계', '할인공급가합계', '비고', '테이스팅노트'
  ];

  const headerRow = sheet.getRow(5);
  headerRow.height = 28;
  headers.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true, size: 10 };
    cell.fill = headerFill;
    cell.border = border;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const dataStartRow = 6;
  items.forEach((item: any, idx: number) => {
    const rowNum = dataStartRow + idx;
    const row = sheet.getRow(rowNum);
    row.height = 22;

    setCellVal(row, 1, idx + 1, border);
    setCellVal(row, 2, item.item_code || '', border);
    setCellVal(row, 3, item.country || '', border);
    setCellVal(row, 4, item.brand || '', border);
    setCellVal(row, 5, item.region || '', border);
    setCellVal(row, 6, item.image_url || '', border);
    setCellVal(row, 7, item.vintage || '', border);
    setCellVal(row, 8, item.product_name || '', border);
    row.getCell(8).font = { bold: true };
    setCellVal(row, 9, item.supply_price || 0, border, currFmt);
    setCellVal(row, 10, item.retail_price || 0, border, currFmt);
    setCellVal(row, 11, item.discount_rate || 0, border, pctFmt);
    // L: 할인가
    const cellL = row.getCell(12);
    cellL.value = { formula: `IFERROR(I${rowNum}*(1-K${rowNum}),"")` } as ExcelJS.CellFormulaValue;
    cellL.numFmt = currFmt; cellL.border = border; cellL.alignment = { horizontal: 'right', vertical: 'middle' };
    setCellVal(row, 13, item.quantity || 0, border);
    // N: 정상공급가합계
    const cellN = row.getCell(14);
    cellN.value = { formula: `IFERROR(I${rowNum}*M${rowNum},"")` } as ExcelJS.CellFormulaValue;
    cellN.numFmt = currFmt; cellN.border = border; cellN.alignment = { horizontal: 'right', vertical: 'middle' };
    // O: 할인공급가합계
    const cellO = row.getCell(15);
    cellO.value = { formula: `IFERROR(L${rowNum}*M${rowNum},"")` } as ExcelJS.CellFormulaValue;
    cellO.numFmt = currFmt; cellO.border = border; cellO.alignment = { horizontal: 'right', vertical: 'middle' };
    setCellVal(row, 16, item.note || '', border);
    setCellVal(row, 17, item.tasting_note || '', border);
  });

  if (items.length > 0) {
    const totalRowNum = dataStartRow + items.length;
    const lastDataRow = totalRowNum - 1;
    const totalRow = sheet.getRow(totalRowNum);
    totalRow.height = 28;
    for (let col = 1; col <= 17; col++) {
      totalRow.getCell(col).border = border;
      totalRow.getCell(col).fill = totalFill;
    }
    totalRow.getCell(8).value = '합계'; totalRow.getCell(8).font = { bold: true, size: 11 };
    totalRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    const tM = totalRow.getCell(13);
    tM.value = { formula: `SUM(M${dataStartRow}:M${lastDataRow})` } as ExcelJS.CellFormulaValue;
    tM.font = { bold: true }; tM.alignment = { horizontal: 'center', vertical: 'middle' };
    const tN = totalRow.getCell(14);
    tN.value = { formula: `SUM(N${dataStartRow}:N${lastDataRow})` } as ExcelJS.CellFormulaValue;
    tN.numFmt = currFmt; tN.font = { bold: true, size: 11 }; tN.alignment = { horizontal: 'right', vertical: 'middle' };
    const tO = totalRow.getCell(15);
    tO.value = { formula: `SUM(O${dataStartRow}:O${lastDataRow})` } as ExcelJS.CellFormulaValue;
    tO.numFmt = currFmt; tO.font = { bold: true, size: 11 }; tO.alignment = { horizontal: 'right', vertical: 'middle' };
  }

  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ── 유틸 ──
function setCellVal(row: ExcelJS.Row, col: number, value: any, border: Partial<ExcelJS.Borders>, numFmt?: string) {
  const cell = row.getCell(col);
  cell.value = value;
  cell.border = border;
  if (numFmt) cell.numFmt = numFmt;
  cell.alignment = {
    horizontal: typeof value === 'number' ? 'right' : 'center',
    vertical: 'middle',
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
