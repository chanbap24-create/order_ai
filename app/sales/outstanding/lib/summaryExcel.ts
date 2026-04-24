/**
 * 미수현황 요약 테이블을 단일 엑셀로 저장.
 * 서버 거치지 않고 클라이언트에서 바로 생성 (exceljs 동적 import).
 */

import type { OutstandingClient, OutstandingTotals, OutstandingType } from "../types";

const FONT = "Malgun Gothic";

type Params = {
  clients: OutstandingClient[];
  totals: OutstandingTotals;
  startDate: string;
  endDate: string;
  type: OutstandingType;
  manager: string;
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSummaryExcel(p: Params): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cave De Vin — 미수현황";
  wb.created = new Date();

  const ws = wb.addWorksheet("미수현황");

  // ── 제목 ──
  const prefix = p.type === "glass" ? "대유라이프" : "까브드뱅";
  ws.mergeCells("A1:H1");
  const title = ws.getCell("A1");
  title.value = `${prefix} 미수현황`;
  title.font = { name: FONT, size: 16, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  // ── 부제목 (기간 · 담당자) ──
  ws.mergeCells("A2:H2");
  const sub = ws.getCell("A2");
  sub.value = `기간: ${p.startDate} ~ ${p.endDate}   담당자: ${p.manager}   작성일: ${new Date().toISOString().slice(0, 10)}`;
  sub.font = { name: FONT, size: 10, color: { argb: "FF666666" } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── 헤더 (row 4) ──
  const headers = ["#", "거래처명", "전월미수", "판매", "부가세", "판매계", "입금", "현미수"];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5A1515" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF2D1A1A" } },
      bottom: { style: "thin", color: { argb: "FF2D1A1A" } },
      left: { style: "thin", color: { argb: "FF5A3030" } },
      right: { style: "thin", color: { argb: "FF5A3030" } },
    };
  });
  headerRow.height = 24;

  // ── 데이터 ──
  const CURR = "#,##0;-#,##0";
  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
    bottom: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
    left: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
    right: { style: "thin" as const, color: { argb: "FFDDDDDD" } },
  };

  p.clients.forEach((c, idx) => {
    const r = ws.getRow(5 + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = c.client_name;
    r.getCell(3).value = c.prev_balance;
    r.getCell(4).value = c.period_supply;
    r.getCell(5).value = c.period_tax;
    r.getCell(6).value = c.period_total;
    r.getCell(7).value = c.period_payment;
    r.getCell(8).value = c.outstanding;

    for (let ci = 1; ci <= 8; ci++) {
      const cell = r.getCell(ci);
      cell.font = { name: FONT, size: 10 };
      cell.border = thinBorder;
      if (ci === 1) cell.alignment = { horizontal: "center", vertical: "middle" };
      else if (ci === 2) cell.alignment = { horizontal: "left", vertical: "middle" };
      else {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = CURR;
      }
    }

    // 현미수 강조
    const o = r.getCell(8);
    o.font = {
      name: FONT, size: 10, bold: true,
      color: { argb: c.outstanding > 0 ? "FFC62828" : c.outstanding < 0 ? "FF1565C0" : "FF2C1810" },
    };
    // 판매계 bold
    r.getCell(6).font = { name: FONT, size: 10, bold: true };
    // 입금 컬럼 파란 색상
    r.getCell(7).font = { name: FONT, size: 10, color: { argb: "FF1565C0" } };

    r.height = 20;
    if (idx % 2 === 1) {
      for (let ci = 1; ci <= 8; ci++) {
        r.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF9F7" } };
      }
    }
  });

  // ── 합계 행 ──
  const totalRow = ws.getRow(5 + p.clients.length);
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = `합계 (${p.clients.length}개)`;
  totalRow.getCell(3).value = p.totals.prev_balance;
  totalRow.getCell(4).value = p.totals.period_supply;
  totalRow.getCell(5).value = p.totals.period_tax;
  totalRow.getCell(6).value = p.totals.period_total;
  totalRow.getCell(7).value = p.totals.period_payment;
  totalRow.getCell(8).value = p.totals.outstanding;

  for (let ci = 1; ci <= 8; ci++) {
    const cell = totalRow.getCell(ci);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5A1515" } };
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF2D1A1A" } },
      bottom: { style: "medium", color: { argb: "FF2D1A1A" } },
      left: { style: "thin", color: { argb: "FF5A3030" } },
      right: { style: "thin", color: { argb: "FF5A3030" } },
    };
    if (ci >= 3) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.numFmt = CURR;
    } else {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  }
  totalRow.height = 24;

  // ── 열 폭 ──
  ws.columns = [
    { width: 5 },   // #
    { width: 28 },  // 거래처명
    { width: 14 },  // 전월미수
    { width: 14 },  // 판매
    { width: 12 },  // 부가세
    { width: 14 },  // 판매계
    { width: 14 },  // 입금
    { width: 14 },  // 현미수
  ];

  // ── 인쇄 설정 ──
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const prefixFn = p.type === "glass" ? "대유라이프" : "까브드뱅";
  const safeManager = (p.manager || "담당자").replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${prefixFn}_미수현황_${safeManager}_${p.startDate}_${p.endDate}.xlsx`;
  triggerDownload(blob, filename);
}
