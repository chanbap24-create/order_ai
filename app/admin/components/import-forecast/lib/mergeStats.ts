import type {
  ChannelStat,
  ManagerStat,
  TopClient,
  WineDetail,
  YearDetail,
} from "../types";

type Totals = {
  totalRaw: number;
  totalCorrected: number;
  totalYear1: number;
  totalClients: number;
};

/**
 * 전체 통합 ManagerStat 생성 (영업사원 "전체" 탭용).
 * 가중평균 가격 + 와인/거래처/채널/연도별 통합.
 */
export function mergeManagerStats(
  results: ManagerStat[] | null,
  totals: Totals,
  isNewItem: boolean,
): ManagerStat | null {
  if (!results || results.length === 0) return null;

  // 와인별 통합 (가격은 판매량 가중 평균)
  const wineAgg: Record<
    string,
    WineDetail & { _supplyAmt: number; _sellingAmt: number; _priceQty: number }
  > = {};
  for (const r of results) {
    for (const w of r.wine_details || []) {
      if (!wineAgg[w.item_name]) {
        wineAgg[w.item_name] = {
          ...w,
          _supplyAmt: w.supply_price * w.total_qty,
          _sellingAmt: w.avg_selling_price * w.total_qty,
          _priceQty: w.total_qty,
        };
      } else {
        const a = wineAgg[w.item_name];
        a._supplyAmt += w.supply_price * w.total_qty;
        a._sellingAmt += w.avg_selling_price * w.total_qty;
        a._priceQty += w.total_qty;
        a.total_qty += w.total_qty;
        a.corrected_qty += w.corrected_qty;
        a.client_count += w.client_count;
        a.years_sold = Math.max(a.years_sold, w.years_sold);
        a.annual_avg += w.annual_avg;
        a.annual_avg_corrected += w.annual_avg_corrected;
        if (w.avg_import_cost > 0 && a.avg_import_cost === 0)
          a.avg_import_cost = w.avg_import_cost;
        a.supply_price = Math.round(a._supplyAmt / a._priceQty);
        a.avg_selling_price = Math.round(a._sellingAmt / a._priceQty);
      }
    }
  }
  const allWines = Object.values(wineAgg).sort(
    (a, b) => b.corrected_qty - a.corrected_qty,
  );

  // 거래처별 통합
  const clientAgg: Record<string, TopClient> = {};
  for (const r of results) {
    for (const c of r.top_clients || []) {
      if (!clientAgg[c.client_name]) clientAgg[c.client_name] = { ...c };
      else {
        clientAgg[c.client_name].total_qty += c.total_qty;
        clientAgg[c.client_name].item_count = Math.max(
          clientAgg[c.client_name].item_count,
          c.item_count,
        );
      }
    }
  }
  const allClients = Object.values(clientAgg)
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 20);

  // 채널별 통합
  const channelAgg: Record<string, ChannelStat> = {};
  for (const r of results) {
    for (const ch of r.channels || []) {
      if (!channelAgg[ch.channel]) channelAgg[ch.channel] = { ...ch };
      else {
        channelAgg[ch.channel].qty += ch.qty;
        channelAgg[ch.channel].annual_qty += ch.annual_qty;
        channelAgg[ch.channel].clients += ch.clients;
        channelAgg[ch.channel].wines = Math.max(
          channelAgg[ch.channel].wines,
          ch.wines,
        );
        channelAgg[ch.channel].qty_per_wine += ch.qty_per_wine;
      }
    }
  }
  const allChannels = Object.values(channelAgg).sort((a, b) => b.qty - a.qty);
  const totalChQty = allChannels.reduce((s, c) => s + c.qty, 0);
  allChannels.forEach((c) => {
    c.pct = totalChQty > 0 ? Math.round((c.qty / totalChQty) * 100) : 0;
  });

  // 연도별 통합
  const yearAgg: Record<string, YearDetail> = {};
  for (const r of results) {
    for (const y of r.year_details || []) {
      if (!yearAgg[y.year]) yearAgg[y.year] = { ...y };
      else {
        yearAgg[y.year].qty += y.qty;
        yearAgg[y.year].correctedQty += y.correctedQty;
        yearAgg[y.year].items = Math.max(yearAgg[y.year].items, y.items);
        yearAgg[y.year].clients += y.clients;
        yearAgg[y.year].qtyPerItem += y.qtyPerItem;
        yearAgg[y.year].qtyPerItemCorrected += y.qtyPerItemCorrected;
      }
    }
  }
  const allYears = Object.values(yearAgg).sort((a, b) =>
    a.year.localeCompare(b.year),
  );

  // 분포
  const perWine = allWines
    .map((w) => w.annual_avg_corrected)
    .filter((v) => v >= 6)
    .sort((a, b) => a - b);
  const med = perWine.length > 0 ? perWine[Math.floor(perWine.length / 2)] : 0;

  return {
    manager: "전체",
    years_active: Math.max(...results.map((r) => r.years_active)),
    avg_annual_qty: results.reduce((s, r) => s + r.avg_annual_qty, 0),
    avg_annual_qty_corrected: results.reduce(
      (s, r) => s + r.avg_annual_qty_corrected,
      0,
    ),
    avg_items: Math.max(...results.map((r) => r.avg_items)),
    qty_per_item_raw: totals.totalRaw,
    qty_per_item: totals.totalCorrected,
    qty_per_item_year1: isNewItem ? totals.totalYear1 : null,
    avg_clients: totals.totalClients,
    min_qty: Math.min(...results.map((r) => r.min_qty)),
    max_qty: results.reduce((s, r) => s + r.max_qty, 0),
    wine_distribution: {
      median: med,
      p25: perWine[Math.floor(perWine.length * 0.25)] || 0,
      p75: perWine[Math.floor(perWine.length * 0.75)] || 0,
      count: perWine.length,
    },
    channels: allChannels,
    year_details: allYears,
    wine_details: allWines,
    top_clients: allClients,
  };
}

export function computeForecastTotals(results: ManagerStat[] | null) {
  if (!results) return { totalRaw: 0, totalCorrected: 0, totalYear1: 0, totalClients: 0 };
  const totalRaw = results.reduce((s, r) => s + r.qty_per_item_raw, 0);
  const totalCorrected = results.reduce((s, r) => s + r.qty_per_item, 0);
  const totalYear1 = results.reduce(
    (s, r) => s + (r.qty_per_item_year1 ?? r.qty_per_item),
    0,
  );
  const totalClients = results.reduce((s, r) => s + r.avg_clients, 0);
  return { totalRaw, totalCorrected, totalYear1, totalClients };
}
