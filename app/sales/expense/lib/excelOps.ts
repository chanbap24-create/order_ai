import type ExcelJS from "exceljs";
import type { ExpenseItem, PreviewRow, VehicleInfo } from "../types";

/** 엑셀 셀 값이 Date이거나 YYYY-MM-DD 문자열이면 문자열로 변환 */
export function cellToDateStr(v: ExcelJS.CellValue): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return "";
}

/** 현재 월(YYYYMM) 시트 이름 추정. 없으면 첫 시트. */
export function getCurrentMonthSheet(names: string[]): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return names.find((n) => n.includes(ym)) || names[0] || "";
}

/**
 * 항목을 시트에 날짜순으로 삽입.
 * - R11부터 마지막 데이터 행까지 스캔
 * - 입력 날짜보다 큰 날짜 행 위에 삽입 (중간이면 기존 행들 아래로 밀기)
 * - 차량유지비면 R56 섹션 km/주유금액 누적
 */
export function writeItemToSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  item: ExpenseItem,
) {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) return;
  const cols = ["A", "B", "C", "D", "E"];

  // 데이터 마지막 행 찾기 (R11~)
  let lastDataRow = 10;
  for (let r = 11; r <= 1000; r++) {
    if (!ws.getCell(`A${r}`).value && !ws.getCell(`D${r}`).value) break;
    lastDataRow = r;
  }

  // 삽입 위치 결정 (날짜 비교)
  let insertRow = lastDataRow + 1;
  for (let r = 11; r <= lastDataRow; r++) {
    const d = cellToDateStr(ws.getCell(`A${r}`).value);
    if (d && d > item.date) {
      insertRow = r;
      break;
    }
  }

  // 중간 삽입이면 기존 행 아래로 밀기
  if (insertRow <= lastDataRow) {
    for (let r = lastDataRow; r >= insertRow; r--) {
      cols.forEach((col) => {
        const src = ws.getCell(`${col}${r}`);
        const tgt = ws.getCell(`${col}${r + 1}`);
        tgt.value = src.value;
        if (src.style) tgt.style = { ...src.style };
      });
    }
  }

  // 새 항목 기입
  ws.getCell(`A${insertRow}`).value = item.date;
  ws.getCell(`B${insertRow}`).value = item.account_category;
  ws.getCell(`C${insertRow}`).value = item.description;
  ws.getCell(`D${insertRow}`).value = item.amount;
  if (item.note) ws.getCell(`E${insertRow}`).value = item.note;
  cols.forEach((col) => {
    const srcCell = ws.getCell(`${col}11`);
    const tgtCell = ws.getCell(`${col}${insertRow}`);
    if (srcCell.style) tgtCell.style = { ...srcCell.style };
  });

  // 차량유지비 → R56 차량비 섹션 업데이트
  if (item.account_category === "차량유지비") {
    const prevKm = Number(ws.getCell("B56").value) || 0;
    const prevFuel = Number(ws.getCell("D56").value) || 0;
    if (item.km) ws.getCell("B56").value = prevKm + item.km;
    if (/주유/.test(item.description)) {
      ws.getCell("D56").value = prevFuel + item.amount;
    }
  }
}

/** 시트의 R11~200 데이터 행 + R56 차량비 정보 추출 */
export function extractPreviewData(
  workbook: ExcelJS.Workbook,
  sheetName: string,
): { rows: PreviewRow[]; vehicleInfo: VehicleInfo | null } {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) return { rows: [], vehicleInfo: null };

  const collected: PreviewRow[] = [];
  let emptyCount = 0;
  for (let rn = 11; rn <= 200; rn++) {
    const row = ws.getRow(rn);
    const cells: string[] = [];
    for (let c = 1; c <= 5; c++) {
      const v = row.getCell(c).value;
      if (v == null) {
        cells.push("");
        continue;
      }
      if (c === 1 && v instanceof Date) {
        cells.push(
          `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`,
        );
      } else {
        cells.push(String(v));
      }
    }
    if (cells.every((c) => !c)) {
      emptyCount++;
      if (emptyCount >= 2) break;
      continue;
    }
    emptyCount = 0;
    collected.push({ rowNum: rn, cells });
  }

  const carNo = ws.getCell("A56").value;
  const vehicleInfo: VehicleInfo | null = carNo
    ? {
        carNo: String(carNo),
        totalKm: Number(ws.getCell("B56").value) || 0,
        totalLiter: Number(ws.getCell("C56").value) || 0,
        totalFuel: Number(ws.getCell("D56").value) || 0,
      }
    : null;

  return { rows: collected, vehicleInfo };
}

/** 미리보기에서 행 삭제 — 해당 행 비우고 아래 행을 위로 당김 */
export function deletePreviewRow(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  excelRowNum: number,
) {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) return;
  const cols = ["A", "B", "C", "D", "E"];

  let lastRow = excelRowNum;
  for (let r = excelRowNum + 1; r <= 200; r++) {
    if (!ws.getCell(`A${r}`).value && !ws.getCell(`D${r}`).value) break;
    lastRow = r;
  }
  for (let r = excelRowNum; r < lastRow; r++) {
    cols.forEach((col) => {
      const below = ws.getCell(`${col}${r + 1}`);
      const cur = ws.getCell(`${col}${r}`);
      cur.value = below.value;
      if (below.style) cur.style = { ...below.style };
    });
  }
  cols.forEach((col) => {
    ws.getCell(`${col}${lastRow}`).value = null;
  });
}
