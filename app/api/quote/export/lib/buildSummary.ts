import type ExcelJS from 'exceljs';
import type { ColDef, DocSettings } from './types';
import { THIN, CURR, SUMMARY_FILL, WHITE_FILL, FONT, colLetter, sc, sf } from './excelStyles';

import { roundTo100 } from '@/app/lib/priceUtils';

/**
 * 합계 행 열별 result를 계산 (모바일/카톡 프리뷰어용 캐시값).
 *  - quantity : 수량 합
 *  - normal_total : supply * qty 합
 *  - discount_total : supply * (1 - discount) * qty 합 (discounted_price 우선)
 *  - retail_normal_total : retail * qty 합
 *  - retail_discount_total : retail * (1 - discount) * qty 합
 */
function computeSumResults(items: Record<string, unknown>[]): Record<string, number> {
  const n = (item: Record<string, unknown>, k: string) => Number(item[k] || 0);
  let qty = 0, normal = 0, discount = 0, retailNormal = 0, retailDiscount = 0;
  for (const item of items) {
    const q = n(item, 'quantity');
    const sp = n(item, 'supply_price');
    const dr = n(item, 'discount_rate');
    const rp = n(item, 'retail_price');
    const dp = n(item, 'discounted_price') > 0
      ? n(item, 'discounted_price')
      : roundTo100(sp * (1 - dr));

    qty += q;
    normal += sp * q;
    discount += dp * q;
    retailNormal += rp * q;
    retailDiscount += roundTo100(rp * (1 - dr)) * q;
  }
  return {
    quantity: qty,
    normal_total: normal,
    discount_total: discount,
    retail_normal_total: retailNormal,
    retail_discount_total: retailDiscount,
  };
}

export function buildSummary(
  ws: ExcelJS.Worksheet,
  activeCols: ColDef[],
  pos: Record<string, number>,
  items: Record<string, unknown>[],
  DS: number,
  doc: DocSettings,
): void {
  const itemsLength = items.length;
  if (itemsLength === 0) return;
  const totalCols = activeCols.length;
  const lastCol = colLetter(totalCols);

  const sumR = DS + itemsLength;
  const row = ws.getRow(sumR);
  row.height = 28;

  for (let c = 1; c <= totalCols; c++) {
    row.getCell(c).border = THIN;
    row.getCell(c).fill = SUMMARY_FILL;
  }

  // "합계" label in best column
  const labelCol = pos['product_name'] || pos['korean_name'] || pos['english_name'] || pos['item_code'] || 1;
  sc(row, labelCol, '합계', { border: THIN, fill: SUMMARY_FILL, bold: true, size: 11 });

  const sumResults = computeSumResults(items);

  const sumKeys: Array<[string, string?]> = [
    ['quantity'],
    ['normal_total', CURR],
    ['discount_total', CURR],
    ['retail_normal_total', CURR],
    ['retail_discount_total', CURR],
  ];
  for (const [key, fmt] of sumKeys) {
    if (pos[key]) {
      const cl = colLetter(pos[key]);
      sf(row, pos[key], `SUM(${cl}${DS}:${cl}${sumR - 1})`, {
        border: THIN, fmt, bold: true, fill: SUMMARY_FILL,
        result: sumResults[key] ?? 0,
      });
    }
  }

  // Footer
  const endR = sumR + 1;
  ws.getCell(`${lastCol}${endR}`).value = '-끝.-';
  ws.getCell(`${lastCol}${endR}`).font = { name: FONT, size: 11 };
  ws.getCell(`${lastCol}${endR}`).alignment = { horizontal: 'right', vertical: 'middle' };

  // Signature block (끝 아래 2줄 여백 추가)
  const sigR = sumR + 5;
  const sigStart = colLetter(Math.max(1, totalCols - 3));

  ws.mergeCells(`${sigStart}${sigR}:${lastCol}${sigR}`);
  ws.getCell(`${sigStart}${sigR}`).value = doc.companyName;
  ws.getCell(`${sigStart}${sigR}`).font = { name: FONT, size: 18, bold: true };
  ws.getCell(`${sigStart}${sigR}`).alignment = { horizontal: 'right', vertical: 'middle' };

  ws.mergeCells(`${sigStart}${sigR + 1}:${lastCol}${sigR + 1}`);
  ws.getCell(`${sigStart}${sigR + 1}`).value = doc.representative;
  ws.getCell(`${sigStart}${sigR + 1}`).font = { name: FONT, size: 14, bold: true };
  ws.getCell(`${sigStart}${sigR + 1}`).alignment = { horizontal: 'right', vertical: 'middle' };

  ws.mergeCells(`${sigStart}${sigR + 2}:${lastCol}${sigR + 2}`);
  ws.getCell(`${sigStart}${sigR + 2}`).value = doc.sealText;
  ws.getCell(`${sigStart}${sigR + 2}`).font = { name: FONT, size: 11 };
  ws.getCell(`${sigStart}${sigR + 2}`).alignment = { horizontal: 'right', vertical: 'middle' };

  // ── 푸터 영역 하얀 배경 + 테두리 제거 ──
  for (let r = endR; r <= sigR + 2; r++) {
    const ftrRow = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      ftrRow.getCell(c).fill = WHITE_FILL;
      ftrRow.getCell(c).border = {};
    }
  }
}
