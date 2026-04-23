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

    const PX_EMU = 9525;
    const PT_EMU = 12700;
    const imgWEmu = imgW * PX_EMU;
    const imgHEmu = imgH * PX_EMU;

    let totalWEmu = 0;
    const colOffsets: number[] = [0];
    for (const col of activeCols) {
      const colPxW = col.width * 7 + 5;
      totalWEmu += colPxW * PX_EMU;
      colOffsets.push(totalWEmu);
    }

    const logoLeftEmu = Math.round((totalWEmu - imgWEmu) / 2);
    const logoRightEmu = logoLeftEmu + imgWEmu;

    const row3HEmu = rowHeight * 0.75 * PT_EMU;
    const logoTopEmu = Math.round((row3HEmu - imgHEmu) / 2);

    let tlCol = 0, tlOff = logoLeftEmu;
    for (let i = 0; i < activeCols.length; i++) {
      if (tlOff < (colOffsets[i + 1] - colOffsets[i])) break;
      tlOff -= (colOffsets[i + 1] - colOffsets[i]);
      tlCol = i + 1;
    }
    let brCol = 0, brOff = logoRightEmu;
    for (let i = 0; i < activeCols.length; i++) {
      if (brOff < (colOffsets[i + 1] - colOffsets[i])) break;
      brOff -= (colOffsets[i + 1] - colOffsets[i]);
      brCol = i + 1;
    }

    ws.addImage(logoId, {
      tl: { nativeCol: tlCol, nativeColOff: tlOff, nativeRow: 0, nativeRowOff: Math.max(0, logoTopEmu) } as unknown as { col: number; row: number },
      br: { nativeCol: brCol, nativeColOff: brOff, nativeRow: 0, nativeRowOff: Math.max(0, logoTopEmu) + imgHEmu } as unknown as { col: number; row: number },
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
