import type {
  LearningCurve,
  ManagerStat,
  PriceStats,
  StockoutInfo,
} from "../types";
import { buildSummarySheet } from "./excelSheets/summarySheet";
import {
  buildClientsSheet,
  buildManagerWinesSheet,
  buildWinesSheet,
  buildYearsSheet,
} from "./excelSheets/detailSheets";
import { buildShipmentsSheet } from "./excelSheets/shipmentsSheet";

type ExportParams = {
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

/**
 * 수입량 예측 결과를 6개 시트 Excel로 내보내기.
 * 시트: 요약 / 판매와인 / 거래처 / 연도별추이 / 영업사원별 와인 / 출고이력
 */
export async function exportForecastExcel(p: ExportParams) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  buildSummarySheet(wb, {
    results: p.results,
    mergedData: p.mergedData,
    isNewItem: p.isNewItem,
    country: p.country,
    regionLabel: p.regionLabel,
    wineType: p.wineType,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    startYear: p.startYear,
    endYear: p.endYear,
    stockoutInfo: p.stockoutInfo,
    learningCurve: p.learningCurve,
    priceStats: p.priceStats,
    totals: p.totals,
  });
  buildWinesSheet(wb, p.mergedData);
  buildClientsSheet(wb, p.results);
  buildYearsSheet(wb, p.mergedData);
  buildManagerWinesSheet(wb, p.results);
  await buildShipmentsSheet(wb, {
    mergedData: p.mergedData,
    startYear: p.startYear,
    endYear: p.endYear,
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `수입량예측_${p.country}${p.regionLabel ? "_" + p.regionLabel : ""}_${p.startYear}-${p.endYear}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
