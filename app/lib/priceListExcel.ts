// 가격리스트 Excel 생성기 (Supabase)
// exceljs 사용

import ExcelJS from "exceljs";
import { getWinesForPriceList } from "@/app/lib/wineDb";
import { supabase } from "@/app/lib/db";
import type { PriceHistoryEntry } from "@/app/types/wine";

const PRIMARY_COLOR = '8B1538';
const NEW_BG_COLOR = 'FFF3CD';
const INCREASE_COLOR = 'FFCDD2';
const DECREASE_COLOR = 'C8E6C9';

async function getRecentPriceChanges(): Promise<PriceHistoryEntry[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('price_history')
    .select('*')
    .gte('detected_at', thirtyDaysAgo)
    .order('detected_at', { ascending: false });
  return (data || []) as PriceHistoryEntry[];
}

export async function generatePriceListExcel(version: 'highlight' | 'clean'): Promise<Buffer> {
  const wines = await getWinesForPriceList();
  const priceChanges = version === 'highlight' ? await getRecentPriceChanges() : [];
  const changedCodes = new Set(priceChanges.map((p) => p.item_code));

  const wb = new ExcelJS.Workbook();
  wb.creator = '까브드뱅 와인 관리 시스템';

  // ── CavedeVin 시트 ──
  const ws1 = wb.addWorksheet('CavedeVin');

  // 제목 행
  ws1.mergeCells('A1:K1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = '까브드뱅 가격리스트';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY_COLOR}` } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 35;

  // 날짜
  ws1.mergeCells('A2:K2');
  const dateCell = ws1.getCell('A2');
  dateCell.value = `생성일: ${new Date().toLocaleDateString('ko-KR')}`;
  dateCell.font = { size: 10, color: { argb: 'FF666666' } };
  dateCell.alignment = { horizontal: 'right' };

  // 헤더 (3-4행)
  ws1.mergeCells('A3:A4'); // No
  ws1.mergeCells('B3:B4'); // 품번
  ws1.mergeCells('C3:C4'); // 품명(한글)
  ws1.mergeCells('D3:D4'); // 품명(영문)
  ws1.mergeCells('E3:E4'); // 국가
  ws1.mergeCells('F3:F4'); // 공급처
  ws1.mergeCells('G3:G4'); // 품종
  ws1.mergeCells('H3:H4'); // 빈티지
  ws1.mergeCells('I3:I4'); // 공급가
  ws1.mergeCells('J3:J4'); // 재고
  ws1.mergeCells('K3:K4'); // 비고

  const headers = ['No', '품번', '품명(한글)', '품명(영문)', '국가', '공급처', '품종', '빈티지', '공급가', '재고', '비고'];
  const headerRow = ws1.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY_COLOR}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin' } };
  });

  // 열 너비
  ws1.getColumn(1).width = 5;  // No
  ws1.getColumn(2).width = 12; // 품번
  ws1.getColumn(3).width = 30; // 품명(한글)
  ws1.getColumn(4).width = 35; // 품명(영문)
  ws1.getColumn(5).width = 12; // 국가
  ws1.getColumn(6).width = 15; // 공급처
  ws1.getColumn(7).width = 20; // 품종
  ws1.getColumn(8).width = 8;  // 빈티지
  ws1.getColumn(9).width = 12; // 공급가
  ws1.getColumn(10).width = 8; // 재고
  ws1.getColumn(11).width = 10; // 비고

  // 데이터 (5행~)
  wines.forEach((w, idx) => {
    const row = ws1.getRow(idx + 5);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = w.item_code;
    row.getCell(3).value = w.item_name_kr;
    row.getCell(4).value = w.item_name_en || '';
    row.getCell(5).value = w.country_en || w.country || '';
    row.getCell(6).value = w.supplier || w.supplier_kr || '';
    row.getCell(7).value = w.grape_varieties || '';
    row.getCell(8).value = w.vintage || '';
    row.getCell(9).value = w.supply_price;
    row.getCell(10).value = w.available_stock;
    row.getCell(11).value = '';

    // 셀 스타일
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '#,##0';

    if (version === 'highlight') {
      // 신규 와인 하이라이트
      if (w.status === 'new') {
        for (let c = 1; c <= 11; c++) {
          row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NEW_BG_COLOR}` } };
        }
        row.getCell(11).value = 'NEW';
      }

      // 가격 변동 하이라이트
      if (changedCodes.has(w.item_code)) {
        const change = priceChanges.find((p) => p.item_code === w.item_code);
        const bgColor = change && (change.change_pct ?? 0) > 0 ? INCREASE_COLOR : DECREASE_COLOR;
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bgColor}` } };
        if (change) {
          row.getCell(11).value = `${(change.change_pct ?? 0) > 0 ? '+' : ''}${change.change_pct?.toFixed(1)}%`;
        }
      }
    }

    // 테두리
    for (let c = 1; c <= 11; c++) {
      row.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      row.getCell(c).font = { size: 10 };
    }
  });

  // ── Downloads 시트 (한글 국가명) ──
  const ws2 = wb.addWorksheet('Downloads');
  const dlHeaders = ['품번', '품명', '규격', '단위', 'IP', '빈티지', '알콜도수%', '국가', '가용재고', '공급가'];
  const dlHeaderRow = ws2.getRow(1);
  dlHeaders.forEach((h, i) => {
    const cell = dlHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  });

  wines.forEach((w, idx) => {
    const row = ws2.getRow(idx + 2);
    row.getCell(1).value = w.item_code;
    row.getCell(2).value = w.item_name_kr;
    row.getCell(3).value = w.volume_ml ? `${w.volume_ml}ml` : '';
    row.getCell(4).value = '';
    row.getCell(5).value = '';
    row.getCell(6).value = w.vintage || '';
    row.getCell(7).value = w.alcohol || '';
    row.getCell(8).value = w.country || '';  // 한글 국가명
    row.getCell(9).value = w.available_stock;
    row.getCell(10).value = w.supply_price;
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '#,##0';
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
