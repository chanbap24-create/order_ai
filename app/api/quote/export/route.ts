import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { ensureQuoteTable } from '@/app/lib/quoteDb';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    ensureQuoteTable();

    const clientName = request.nextUrl.searchParams.get('client_name') || '';
    const items = db.prepare('SELECT * FROM quote_items ORDER BY id ASC').all() as any[];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cave De Vin - Order AI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('견적서', {
      views: [{ showGridLines: true }],
    });

    // ── 컬럼 너비 설정 ──
    sheet.columns = [
      { width: 5 },   // A: No.
      { width: 12 },  // B: 품목코드
      { width: 8 },   // C: 국가
      { width: 14 },  // D: 브랜드
      { width: 10 },  // E: 지역
      { width: 20 },  // F: 이미지
      { width: 8 },   // G: 빈티지
      { width: 30 },  // H: 상품명
      { width: 12 },  // I: 공급가
      { width: 8 },   // J: 할인율
      { width: 12 },  // K: 할인가
      { width: 6 },   // L: 수량
      { width: 14 },  // M: 정상공급가합계
      { width: 14 },  // N: 할인공급가합계
      { width: 15 },  // O: 비고
      { width: 20 },  // P: 테이스팅노트
    ];

    // ── 스타일 상수 ──
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD6EAF8' },
    };

    const totalFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' },
    };

    const currencyFormat = '#,##0';
    const percentFormat = '0%';

    // ── Row 1-3: 회사 헤더 (병합) ──
    sheet.mergeCells('A1:P1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Cave De Vin 견적서';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF8B1538' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    sheet.mergeCells('A2:P2');
    const infoCell = sheet.getCell('A2');
    infoCell.value = clientName
      ? `거래처: ${clientName}  |  작성일: ${formatDate(new Date())}  |  VAT 별도  |  WON 기준`
      : `작성일: ${formatDate(new Date())}  |  VAT 별도  |  WON 기준`;
    infoCell.font = { size: 10, color: { argb: 'FF666666' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 22;

    sheet.mergeCells('A3:P3');
    const contactCell = sheet.getCell('A3');
    contactCell.value = 'Cave De Vin  |  서울특별시  |  Tel: 02-XXX-XXXX  |  Fax: 02-XXX-XXXX';
    contactCell.font = { size: 9, color: { argb: 'FF999999' } };
    contactCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 20;

    // ── Row 4: 빈 줄 ──
    sheet.getRow(4).height = 8;

    // ── Row 5: 컬럼 헤더 ──
    const headers = [
      'No.', '품목코드', '국가', '브랜드', '지역', '이미지',
      '빈티지', '상품명', '공급가', '할인율', '할인가', '수량',
      '정상공급가합계', '할인공급가합계', '비고', '테이스팅노트'
    ];

    const headerRow = sheet.getRow(5);
    headerRow.height = 28;
    headers.forEach((text, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = text;
      cell.font = { bold: true, size: 10 };
      cell.fill = headerFill;
      cell.border = thinBorder;
      cell.alignment = {
        horizontal: i >= 8 && i <= 13 ? 'right' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });

    // ── Row 6+: 데이터 행 ──
    const dataStartRow = 6;

    items.forEach((item: any, idx: number) => {
      const rowNum = dataStartRow + idx;
      const row = sheet.getRow(rowNum);
      row.height = 22;

      // A: No.
      const cellA = row.getCell(1);
      cellA.value = idx + 1;
      cellA.alignment = { horizontal: 'center', vertical: 'middle' };
      cellA.border = thinBorder;

      // B: 품목코드
      const cellB = row.getCell(2);
      cellB.value = item.item_code || '';
      cellB.alignment = { horizontal: 'center', vertical: 'middle' };
      cellB.border = thinBorder;

      // C: 국가
      const cellC = row.getCell(3);
      cellC.value = item.country || '';
      cellC.alignment = { horizontal: 'center', vertical: 'middle' };
      cellC.border = thinBorder;

      // D: 브랜드
      const cellD = row.getCell(4);
      cellD.value = item.brand || '';
      cellD.alignment = { horizontal: 'left', vertical: 'middle' };
      cellD.border = thinBorder;

      // E: 지역
      const cellE = row.getCell(5);
      cellE.value = item.region || '';
      cellE.alignment = { horizontal: 'center', vertical: 'middle' };
      cellE.border = thinBorder;

      // F: 이미지 (URL 문자열 — TODO: 실제 이미지 삽입)
      const cellF = row.getCell(6);
      cellF.value = item.image_url || '';
      cellF.alignment = { horizontal: 'left', vertical: 'middle' };
      cellF.border = thinBorder;
      cellF.font = { size: 9, color: { argb: 'FF999999' } };

      // G: 빈티지
      const cellG = row.getCell(7);
      cellG.value = item.vintage || '';
      cellG.alignment = { horizontal: 'center', vertical: 'middle' };
      cellG.border = thinBorder;

      // H: 상품명
      const cellH = row.getCell(8);
      cellH.value = item.product_name || '';
      cellH.alignment = { horizontal: 'left', vertical: 'middle' };
      cellH.border = thinBorder;
      cellH.font = { bold: true };

      // I: 공급가
      const cellI = row.getCell(9);
      cellI.value = Number(item.supply_price) || 0;
      cellI.numFmt = currencyFormat;
      cellI.alignment = { horizontal: 'right', vertical: 'middle' };
      cellI.border = thinBorder;

      // J: 할인율
      const cellJ = row.getCell(10);
      cellJ.value = Number(item.discount_rate) || 0;
      cellJ.numFmt = percentFormat;
      cellJ.alignment = { horizontal: 'center', vertical: 'middle' };
      cellJ.border = thinBorder;

      // K: 할인가 (수식)
      const cellK = row.getCell(11);
      cellK.value = { formula: `IFERROR(I${rowNum}*(1-J${rowNum}),"")` } as ExcelJS.CellFormulaValue;
      cellK.numFmt = currencyFormat;
      cellK.alignment = { horizontal: 'right', vertical: 'middle' };
      cellK.border = thinBorder;

      // L: 수량
      const cellL = row.getCell(12);
      cellL.value = Number(item.quantity) || 0;
      cellL.alignment = { horizontal: 'center', vertical: 'middle' };
      cellL.border = thinBorder;

      // M: 정상공급가합계 (수식)
      const cellM = row.getCell(13);
      cellM.value = { formula: `IFERROR(I${rowNum}*L${rowNum},"")` } as ExcelJS.CellFormulaValue;
      cellM.numFmt = currencyFormat;
      cellM.alignment = { horizontal: 'right', vertical: 'middle' };
      cellM.border = thinBorder;

      // N: 할인공급가합계 (수식)
      const cellN = row.getCell(14);
      cellN.value = { formula: `IFERROR(K${rowNum}*L${rowNum},"")` } as ExcelJS.CellFormulaValue;
      cellN.numFmt = currencyFormat;
      cellN.alignment = { horizontal: 'right', vertical: 'middle' };
      cellN.border = thinBorder;

      // O: 비고
      const cellO = row.getCell(15);
      cellO.value = item.note || '';
      cellO.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      cellO.border = thinBorder;

      // P: 테이스팅노트
      const cellP = row.getCell(16);
      cellP.value = item.tasting_note || '';
      cellP.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      cellP.border = thinBorder;
    });

    // ── 합계 행 ──
    if (items.length > 0) {
      const totalRowNum = dataStartRow + items.length;
      const lastDataRow = totalRowNum - 1;
      const totalRow = sheet.getRow(totalRowNum);
      totalRow.height = 28;

      // 합계 라벨
      const labelCell = totalRow.getCell(8);
      labelCell.value = '합계';
      labelCell.font = { bold: true, size: 11 };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      labelCell.border = thinBorder;
      labelCell.fill = totalFill;

      // 빈 셀에도 스타일 적용
      for (let col = 1; col <= 16; col++) {
        const cell = totalRow.getCell(col);
        cell.border = thinBorder;
        cell.fill = totalFill;
      }

      // M: 정상공급가합계 합산
      const totalM = totalRow.getCell(13);
      totalM.value = { formula: `SUM(M${dataStartRow}:M${lastDataRow})` } as ExcelJS.CellFormulaValue;
      totalM.numFmt = currencyFormat;
      totalM.font = { bold: true, size: 11 };
      totalM.alignment = { horizontal: 'right', vertical: 'middle' };

      // N: 할인공급가합계 합산
      const totalN = totalRow.getCell(14);
      totalN.value = { formula: `SUM(N${dataStartRow}:N${lastDataRow})` } as ExcelJS.CellFormulaValue;
      totalN.numFmt = currencyFormat;
      totalN.font = { bold: true, size: 11 };
      totalN.alignment = { horizontal: 'right', vertical: 'middle' };

      // L: 수량 합산
      const totalL = totalRow.getCell(12);
      totalL.value = { formula: `SUM(L${dataStartRow}:L${lastDataRow})` } as ExcelJS.CellFormulaValue;
      totalL.font = { bold: true };
      totalL.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // ── 인쇄 설정 ──
    sheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

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

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
