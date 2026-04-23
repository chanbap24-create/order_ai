import type { Workbook } from "exceljs";
import type {
  LearningCurve,
  ManagerStat,
  PriceStats,
  StockoutInfo,
} from "../../types";
import { BODY_FONT, BOLD_FONT, BURGUNDY, styleBody, styleHeader } from "./styles";

type Params = {
  results: ManagerStat[];
  mergedData: ManagerStat;
  isNewItem: boolean;
  country: string;
  regionLabel: string;
  wineType: string;
  priceMin: string;
  priceMax: string;
  startYear: string;
  endYear: string;
  stockoutInfo: StockoutInfo | null;
  learningCurve: LearningCurve | null;
  priceStats: PriceStats | null;
  totals: { totalCorrected: number; totalYear1: number; totalClients: number };
};

export function buildSummarySheet(wb: Workbook, p: Params) {
  const ws = wb.addWorksheet("요약");
  ws.columns = [
    { header: "영업사원", key: "mgr", width: 14 },
    { header: "활동연수", key: "years", width: 10 },
    { header: "연평균판매(보정)", key: "avgQty", width: 18 },
    { header: "평균품목수", key: "items", width: 12 },
    { header: "기대값(병/년)", key: "qpi", width: 16 },
    ...(p.isNewItem ? [{ header: "1년차예상", key: "y1" as const, width: 14 }] : []),
    { header: "평균거래처", key: "clients", width: 12 },
    { header: "와인분포(중위)", key: "median", width: 16 },
  ];
  styleHeader(ws);

  const allRow: Record<string, unknown> = {
    mgr: "전체 합계",
    years: p.mergedData.years_active,
    avgQty: p.mergedData.avg_annual_qty_corrected,
    items: p.mergedData.avg_items,
    qpi: p.totals.totalCorrected,
    clients: p.totals.totalClients,
    median: p.mergedData.wine_distribution.median,
  };
  if (p.isNewItem) allRow.y1 = p.totals.totalYear1;
  ws.addRow(allRow);
  const totalRow = ws.getRow(2);
  for (let c = 1; c <= ws.columns.length; c++) {
    totalRow.getCell(c).font = { ...BOLD_FONT, size: 11, color: { argb: BURGUNDY } };
    totalRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF0ED" },
    };
    totalRow.getCell(c).border = { bottom: { style: "medium", color: { argb: BURGUNDY } } };
  }
  totalRow.height = 26;

  for (const r of p.results) {
    const row: Record<string, unknown> = {
      mgr: r.manager,
      years: r.years_active,
      avgQty: r.avg_annual_qty_corrected,
      items: r.avg_items,
      qpi: r.qty_per_item,
      clients: r.avg_clients,
      median: r.wine_distribution.median,
    };
    if (p.isNewItem) row.y1 = r.qty_per_item_year1;
    ws.addRow(row);
  }
  styleBody(ws, [3, 5, 6, 7, 8]);

  // 보정 정보
  const infoRow = ws.rowCount + 2;
  ws.mergeCells(`A${infoRow}:D${infoRow}`);
  ws.getCell(`A${infoRow}`).value = "분석 조건";
  ws.getCell(`A${infoRow}`).font = { ...BOLD_FONT, size: 11 };
  ws.getCell(`A${infoRow}`).border = {
    bottom: { style: "medium", color: { argb: BURGUNDY } },
  };
  const conditions = [
    `${p.isNewItem ? "신규" : "기존"} · ${p.country}${p.regionLabel ? " · " + p.regionLabel : ""}${p.wineType ? " · " + p.wineType : ""} · ${Number(p.priceMin).toLocaleString()}~${Number(p.priceMax).toLocaleString()}원 · ${p.startYear}~${p.endYear}`,
    p.stockoutInfo && p.stockoutInfo.correctedWines > 0
      ? `재고소진 보정: ${p.stockoutInfo.correctedWines}개 와인, 평균 ×${p.stockoutInfo.avgFactor}`
      : "",
    p.learningCurve
      ? `러닝커브: ${Math.round(p.learningCurve.ratio * 100)}% (${p.learningCurve.sampleSize}개 샘플)`
      : "",
    p.priceStats
      ? `평균공급가: ${p.priceStats.avg.toLocaleString()}원 (${p.priceStats.min.toLocaleString()}~${p.priceStats.max.toLocaleString()})`
      : "",
  ].filter(Boolean);
  conditions.forEach((txt, i) => {
    ws.mergeCells(`A${infoRow + 1 + i}:F${infoRow + 1 + i}`);
    ws.getCell(`A${infoRow + 1 + i}`).value = txt;
    ws.getCell(`A${infoRow + 1 + i}`).font = {
      ...BODY_FONT,
      color: { argb: "FF8A8580" },
    };
  });
}
