import type { Workbook } from "exceljs";
import type { ManagerStat } from "../../types";
import { styleBody, styleHeader } from "./styles";

export function buildWinesSheet(wb: Workbook, mergedData: ManagerStat) {
  const ws = wb.addWorksheet("판매와인");
  ws.columns = [
    { header: "와인명", key: "name", width: 36 },
    { header: "품번", key: "code", width: 16 },
    { header: "지역", key: "region", width: 20 },
    { header: "공급가", key: "supply", width: 12 },
    { header: "평균공급가", key: "avg", width: 13 },
    { header: "할인율", key: "disc", width: 10 },
    { header: "거래처", key: "clients", width: 9 },
    { header: "연수", key: "years", width: 7 },
    { header: "총판매", key: "total", width: 11 },
    { header: "보정판매", key: "corrected", width: 11 },
    { header: "연평균(보정)", key: "annual", width: 13 },
    { header: "품절보정", key: "factor", width: 10 },
  ];
  styleHeader(ws);
  for (const w of mergedData.wine_details || []) {
    ws.addRow({
      name: w.item_name,
      code: w.item_code,
      region: w.region || "",
      supply: w.supply_price,
      avg: w.avg_selling_price,
      disc:
        w.supply_price > 0 && w.avg_selling_price > 0
          ? (w.avg_selling_price - w.supply_price) / w.supply_price
          : 0,
      clients: w.client_count,
      years: w.years_sold,
      total: w.total_qty,
      corrected: w.corrected_qty,
      annual: w.annual_avg_corrected,
      factor: w.stockout_factor > 1 ? `×${w.stockout_factor}` : "",
    });
  }
  styleBody(ws, [4, 5, 9, 10, 11], [6]);
}

export function buildClientsSheet(wb: Workbook, results: ManagerStat[]) {
  const ws = wb.addWorksheet("거래처");
  ws.columns = [
    { header: "#", key: "rank", width: 6 },
    { header: "거래처명", key: "name", width: 32 },
    { header: "업종", key: "biz", width: 14 },
    { header: "품목수", key: "items", width: 10 },
    { header: "총구매(병)", key: "qty", width: 14 },
  ];
  styleHeader(ws);
  const agg: Record<string, { qty: number; items: number; biz: string }> = {};
  for (const r of results) {
    for (const c of r.top_clients || []) {
      if (!agg[c.client_name])
        agg[c.client_name] = { qty: 0, items: 0, biz: c.business_type || "" };
      agg[c.client_name].qty += c.total_qty;
      agg[c.client_name].items = Math.max(agg[c.client_name].items, c.item_count);
    }
  }
  Object.entries(agg)
    .sort(([, a], [, b]) => b.qty - a.qty)
    .forEach(([name, v], i) => {
      ws.addRow({ rank: i + 1, name, biz: v.biz, items: v.items, qty: v.qty });
    });
  styleBody(ws, [5]);
}

export function buildYearsSheet(wb: Workbook, mergedData: ManagerStat) {
  const ws = wb.addWorksheet("연도별추이");
  ws.columns = [
    { header: "연도", key: "year", width: 10 },
    { header: "판매량", key: "qty", width: 12 },
    { header: "보정판매량", key: "corrected", width: 14 },
    { header: "와인수", key: "items", width: 10 },
    { header: "거래처수", key: "clients", width: 10 },
    { header: "와인당판매(보정)", key: "perItem", width: 18 },
  ];
  styleHeader(ws);
  for (const y of mergedData.year_details || []) {
    ws.addRow({
      year: y.year,
      qty: y.qty,
      corrected: y.correctedQty,
      items: y.items,
      clients: y.clients,
      perItem: y.qtyPerItemCorrected,
    });
  }
  styleBody(ws, [2, 3, 6]);
}

export function buildManagerWinesSheet(wb: Workbook, results: ManagerStat[]) {
  const ws = wb.addWorksheet("영업사원별 와인");
  ws.columns = [
    { header: "영업사원", key: "mgr", width: 12 },
    { header: "와인명", key: "name", width: 36 },
    { header: "공급가", key: "supply", width: 12 },
    { header: "평균공급가", key: "avg", width: 13 },
    { header: "거래처", key: "clients", width: 9 },
    { header: "총판매", key: "total", width: 11 },
    { header: "연평균(보정)", key: "annual", width: 13 },
  ];
  styleHeader(ws);
  for (const r of results) {
    for (const w of r.wine_details || []) {
      ws.addRow({
        mgr: r.manager,
        name: w.item_name,
        supply: w.supply_price,
        avg: w.avg_selling_price,
        clients: w.client_count,
        total: w.total_qty,
        annual: w.annual_avg_corrected,
      });
    }
  }
  styleBody(ws, [3, 4, 6, 7]);
}
