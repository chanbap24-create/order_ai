import type ExcelJS from 'exceljs';

export const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD5CEC8' } },
  left: { style: 'thin', color: { argb: 'FFD5CEC8' } },
  bottom: { style: 'thin', color: { argb: 'FFD5CEC8' } },
  right: { style: 'thin', color: { argb: 'FFD5CEC8' } },
};

export const CURR = '#,##0';
export const PCT = '0%';
export const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D1C1C' } };
export const ALT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F7F5' } };
export const SUMMARY_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EBE6' } };
export const WHITE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
export const FONT = '맑은 고딕';

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function colLetter(n: number): string {
  return String.fromCharCode(64 + n);
}

type CellOptions = {
  border?: Partial<ExcelJS.Borders>;
  fmt?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  fill?: ExcelJS.Fill;
  size?: number;
  wrap?: boolean;
};

export function sc(row: ExcelJS.Row, col: number, value: unknown, o?: CellOptions) {
  const cell = row.getCell(col);
  cell.value = value as ExcelJS.CellValue;
  if (o?.border) cell.border = o.border;
  if (o?.fmt) cell.numFmt = o.fmt;
  cell.alignment = {
    horizontal: o?.align ?? (typeof value === 'number' ? 'right' : 'center'),
    vertical: 'middle',
    wrapText: o?.wrap ?? false,
  };
  const font: Partial<ExcelJS.Font> = { name: FONT, size: o?.size ?? 10 };
  if (o?.bold) font.bold = true;
  if (o?.color) font.color = { argb: o.color };
  cell.font = font;
  if (o?.fill) cell.fill = o.fill;
}

type FormulaOptions = {
  border?: Partial<ExcelJS.Borders>;
  fmt?: string;
  bold?: boolean;
  color?: string;
  fill?: ExcelJS.Fill;
  size?: number;
  // 수식의 계산된 결과값 (카톡/모바일 프리뷰어는 수식 계산 엔진이 없어
  // 캐시된 result 없으면 공란으로 보임). 숫자면 같이 저장.
  result?: number | string;
};

export function sf(row: ExcelJS.Row, col: number, formula: string, o?: FormulaOptions) {
  const cell = row.getCell(col);
  if (o?.result !== undefined && o.result !== null && o.result !== '') {
    cell.value = { formula, result: o.result } as ExcelJS.CellFormulaValue;
  } else {
    cell.value = { formula } as ExcelJS.CellFormulaValue;
  }
  if (o?.border) cell.border = o.border;
  if (o?.fmt) cell.numFmt = o.fmt;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  const font: Partial<ExcelJS.Font> = { name: FONT, size: o?.size ?? 10 };
  if (o?.bold) font.bold = true;
  if (o?.color) font.color = { argb: o.color };
  cell.font = font;
  if (o?.fill) cell.fill = o.fill;
}
