import fs from 'fs';
import type ExcelJS from 'exceljs';
import type { ColDef, DocSettings } from './types';
import { getLogoPath } from './assets';
import { FONT, WHITE_FILL, colLetter, fmtDate } from './excelStyles';

/**
 * 견적서 상단 (로고 + 주소 + 수신/발신/제목 + 내용 블록).
 * 반환값 없음. 20행까지 채움. 본문은 row 21(헤더)부터 시작 예정.
 */
export function buildHeader(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  activeCols: ColDef[],
  clientName: string,
  doc: DocSettings,
  company: string,
): void {
  const totalCols = activeCols.length;
  const lastCol = colLetter(totalCols);

  // Row 1: Company logo or name
  ws.mergeCells(`A1:${lastCol}1`);
  const logoPath = getLogoPath(company);
  if (logoPath) {
    const logoBuffer = fs.readFileSync(logoPath);
    const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
    const imgH = company === 'DL' ? 150 : 100;
    const imgW = company === 'DL' ? Math.round(231 * (150 / 160)) : Math.round(307 * (100 / 100));
    const rowHeight = imgH + 10;
    ws.getRow(1).height = rowHeight * 0.75;

    // 각 열 width(px) = width * 7 + 5 (Excel 관례)
    const colWidthsPx = activeCols.map((col) => col.width * 7 + 5);
    const totalPxWidth = colWidthsPx.reduce((sum, w) => sum + w, 0);

    // 가로 중앙 위치(px) → 해당 열 인덱스(0-base)와 열 내 오프셋(px)
    const startXPx = Math.max(0, (totalPxWidth - imgW) / 2);
    let colIndex = 0;
    let offsetInColPx = startXPx;
    for (let i = 0; i < colWidthsPx.length; i++) {
      if (offsetInColPx < colWidthsPx[i]) { colIndex = i; break; }
      offsetInColPx -= colWidthsPx[i];
      colIndex = i + 1;
    }

    // 행 1 높이(pt) 기준 세로 중앙(px)
    const rowHeightPx = rowHeight * 0.75 * (96 / 72); // pt → px
    const topOffsetPx = Math.max(0, (rowHeightPx - imgH) / 2);

    // 주의: ExcelJS fractional(tl.col) 방식은 열 폭을 width×10000 EMU로 가정해
    // 열 내 오프셋이 실제의 ~1/7로 줄어드는 버그가 있음(중앙정렬 깨짐).
    // 픽셀→EMU(×9525) 직접 변환으로 nativeColOff를 지정한다.
    // 출력 XML(xdr:col/colOff) 구조는 fractional 방식과 동일 → 뷰어 호환성 차이 없음.
    const PX_EMU = 9525;
    ws.addImage(logoId, {
      tl: {
        nativeCol: colIndex,
        nativeColOff: Math.round(offsetInColPx * PX_EMU),
        nativeRow: 0,
        nativeRowOff: Math.round(topOffsetPx * PX_EMU),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      ext: { width: imgW, height: imgH },
      editAs: 'oneCell',
    });
  } else {
    const titleCell = ws.getCell('A1');
    titleCell.value = doc.companyName;
    titleCell.font = { name: FONT, size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;
  }

  // Row 2: 한글 주소
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A2').value = doc.address;
  ws.getCell('A2').font = { name: FONT, size: 8 };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: 영문 주소
  ws.mergeCells(`A3:${lastCol}3`);
  ws.getCell('A3').value = doc.addressEn || '';
  ws.getCell('A3').font = { name: FONT, size: 7 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: 웹사이트/SNS URL
  ws.mergeCells(`A4:${lastCol}4`);
  ws.getCell('A4').value = doc.websiteUrl || '';
  ws.getCell('A4').font = { name: FONT, size: 7 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 5~8: spacer
  ws.getRow(5).height = 16.5;
  ws.getRow(6).height = 16.5;
  ws.getRow(7).height = 16.5;
  ws.getRow(8).height = 16.5;

  // Row 9: 수신 + date
  ws.getCell('A9').value = `수      신 : ${clientName || ''}`;
  ws.getCell('A9').font = { name: FONT, size: 11 };
  ws.getCell(`${lastCol}9`).value = fmtDate(new Date());
  ws.getCell(`${lastCol}9`).font = { name: FONT, size: 11 };
  ws.getCell(`${lastCol}9`).alignment = { horizontal: 'right', vertical: 'middle' };

  ws.getRow(10).height = 12.5;

  ws.getCell('A11').value = `발      신 : ${doc.sender}`;
  ws.getCell('A11').font = { name: FONT, size: 11 };

  ws.getRow(12).height = 12.5;

  ws.getCell('A13').value = `제      목 : ${doc.title}`;
  ws.getCell('A13').font = { name: FONT, size: 11, bold: true };

  ws.getRow(14).height = 8;

  ws.getCell('A15').value = doc.content1;
  ws.getCell('A15').font = { name: FONT, size: 11 };

  ws.getRow(16).height = 12.5;

  ws.getCell('A17').value = doc.content2;
  ws.getCell('A17').font = { name: FONT, size: 11 };

  ws.getRow(18).height = 8;

  ws.mergeCells(`A19:${lastCol}19`);
  ws.getCell('A19').value = doc.content3;
  ws.getCell('A19').font = { name: FONT, size: 11 };
  ws.getCell('A19').alignment = { horizontal: 'center', vertical: 'middle' };

  // ── 헤더 영역 (rows 1-19) 하얀 배경 + 테두리 제거 ──
  for (let r = 1; r <= 19; r++) {
    const hdrRow = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      hdrRow.getCell(c).fill = WHITE_FILL;
      hdrRow.getCell(c).border = {};
    }
  }

  // Row 20: 제품 및 가격 + 단위
  ws.getCell('A20').value = '1. 제품 및 가격 :';
  ws.getCell('A20').font = { name: FONT, size: 10 };
  ws.getCell('A20').alignment = { vertical: 'middle' };
  const unitStartCol = colLetter(Math.max(1, totalCols - 2));
  if (totalCols > 3) {
    ws.mergeCells(`${unitStartCol}20:${lastCol}20`);
  }
  ws.getCell(`${unitStartCol}20`).value = doc.unit;
  ws.getCell(`${unitStartCol}20`).font = { name: FONT, size: 10 };
  ws.getCell(`${unitStartCol}20`).alignment = { horizontal: 'right', vertical: 'middle' };
  for (let c = 1; c <= totalCols; c++) {
    ws.getRow(20).getCell(c).fill = WHITE_FILL;
    ws.getRow(20).getCell(c).border = { bottom: { style: 'medium' } };
  }
}
