import type { Borders, FillPattern, Font, Worksheet } from "exceljs";

export const BURGUNDY = "FF5A1515";
export const LIGHT_BG = "FFF9F5F3";
export const BORDER_COLOR = "FFE0DBD7";
export const NUM_FMT = "#,##0";
export const PCT_FMT = "0.0%";

export const HEADER_FILL: FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: BURGUNDY },
};
export const HEADER_FONT: Partial<Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
  name: "Arial",
};
export const BODY_FONT: Partial<Font> = { size: 10, name: "Arial" };
export const BOLD_FONT: Partial<Font> = { ...BODY_FONT, bold: true };
export const THIN_BORDER: Partial<Borders> = {
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
};

export const styleHeader = (ws: Worksheet) => {
  const row = ws.getRow(1);
  for (let c = 1; c <= ws.columns.length; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: BURGUNDY } } };
  }
  row.height = 28;
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
};

export const styleBody = (ws: Worksheet, numCols: number[], pctCols: number[] = []) => {
  ws.eachRow((row, idx) => {
    if (idx <= 1) return;
    for (let c = 1; c <= ws.columns.length; c++) {
      const cell = row.getCell(c);
      cell.font = BODY_FONT;
      cell.border = THIN_BORDER;
      if (idx % 2 === 0)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BG } };
    }
    numCols.forEach((c) => {
      row.getCell(c).numFmt = NUM_FMT;
    });
    pctCols.forEach((c) => {
      row.getCell(c).numFmt = PCT_FMT;
    });
  });
};
