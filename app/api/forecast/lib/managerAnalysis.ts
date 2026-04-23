import type { Shipment, StockoutCorrection, LearningCurve, WineMapEntry } from "./types";
import { MANAGERS } from "./constants";

type ManagerResult = {
  manager: string;
  years_active: number;
  avg_annual_qty: number;
  avg_annual_qty_corrected: number;
  avg_items: number;
  qty_per_item_raw: number;
  qty_per_item: number;
  qty_per_item_year1: number | null;
  avg_clients: number;
  min_qty: number;
  max_qty: number;
  wine_distribution: { median: number; p25: number; p75: number; count: number };
  channels: Array<{
    channel: string;
    qty: number;
    annual_qty: number;
    clients: number;
    wines: number;
    qty_per_wine: number;
    pct: number;
  }>;
  year_details: Array<{
    year: string;
    qty: number;
    correctedQty: number;
    items: number;
    clients: number;
    qtyPerItem: number;
    qtyPerItemCorrected: number;
  }>;
  wine_details: Array<{
    item_code: string;
    item_name: string;
    supply_price: number;
    avg_import_cost: number;
    avg_selling_price: number;
    region: string | null;
    total_qty: number;
    corrected_qty: number;
    stockout_factor: number;
    client_count: number;
    years_sold: number;
    annual_avg: number;
    annual_avg_corrected: number;
  }>;
  top_clients: Array<{
    client_name: string;
    total_qty: number;
    item_count: number;
    business_type: string;
  }>;
};

export function analyzeManagers(
  periodShipments: Shipment[],
  wineMap: Record<string, WineMapEntry>,
  getWineName: (itemNo: string) => string,
  stockoutCorrections: Record<string, StockoutCorrection>,
  learningCurve: LearningCurve | null,
  isNewItem: boolean,
  clientBusinessType: Record<string, string>,
): ManagerResult[] {
  const managerGroups: Record<string, Shipment[]> = {};
  for (const s of periodShipments) {
    if (!MANAGERS.includes(s.manager)) continue;
    if (!managerGroups[s.manager]) managerGroups[s.manager] = [];
    managerGroups[s.manager].push(s);
  }

  const results: ManagerResult[] = [];

  for (const manager of MANAGERS) {
    const mShipments = managerGroups[manager] || [];
    if (mShipments.length === 0) continue;

    const yearMap: Record<string, { qty: number; correctedQty: number; wineNames: Set<string>; clients: Set<string> }> = {};
    const wineStats: Record<string, { qty: number; correctedQty: number; clients: Set<string>; years: Set<string>; codes: Set<string>; price: number; importCost: number; totalListAmt: number; totalListQty: number; totalUnitAmt: number; totalUnitQty: number }> = {};
    const clientStats: Record<string, { qty: number; wineNames: Set<string> }> = {};
    const channelStats: Record<string, { qty: number; correctedQty: number; clients: Set<string>; wineNames: Set<string> }> = {};

    for (const s of mShipments) {
      const yr = s.ship_date?.substring(0, 4);
      if (!yr) continue;
      const wineName = getWineName(s.item_no);
      const qty = s.quantity || 0;
      const factor = stockoutCorrections[wineName]?.factor || 1;
      const correctedQty = Math.round(qty * factor);

      if (!yearMap[yr]) yearMap[yr] = { qty: 0, correctedQty: 0, wineNames: new Set(), clients: new Set() };
      yearMap[yr].qty += qty;
      yearMap[yr].correctedQty += correctedQty;
      yearMap[yr].wineNames.add(wineName);
      yearMap[yr].clients.add(s.client_name);

      if (!wineStats[wineName]) wineStats[wineName] = {
        qty: 0, correctedQty: 0, clients: new Set(), years: new Set(), codes: new Set(),
        price: wineMap[s.item_no]?.price || 0,
        importCost: wineMap[s.item_no]?.importCost || 0,
        totalListAmt: 0, totalListQty: 0, totalUnitAmt: 0, totalUnitQty: 0,
      };
      wineStats[wineName].qty += qty;
      wineStats[wineName].correctedQty += correctedQty;
      wineStats[wineName].clients.add(s.client_name);
      wineStats[wineName].years.add(yr);
      wineStats[wineName].codes.add(s.item_no);
      if (qty > 0) {
        const listPrice = wineMap[s.item_no]?.price || 0;
        if (listPrice > 0) {
          wineStats[wineName].totalListAmt += listPrice * qty;
          wineStats[wineName].totalListQty += qty;
        }
        const isNew = s.ship_date >= '2025-08-01';
        const totalAmt = isNew ? (s.supply_amount || 0) : (s.selling_price || s.supply_amount || 0);
        const perUnitPrice = Math.abs(qty) > 0 ? Math.round(Math.abs(totalAmt) / Math.abs(qty)) : 0;
        if (perUnitPrice > 0 && (listPrice === 0 || perUnitPrice <= listPrice * 1.5)) {
          wineStats[wineName].totalUnitAmt += perUnitPrice * qty;
          wineStats[wineName].totalUnitQty += qty;
        }
      }

      if (!clientStats[s.client_name]) clientStats[s.client_name] = { qty: 0, wineNames: new Set() };
      clientStats[s.client_name].qty += qty;
      clientStats[s.client_name].wineNames.add(wineName);

      const bt = (s.business_type || '').trim() || '(미분류)';
      if (!channelStats[bt]) channelStats[bt] = { qty: 0, correctedQty: 0, clients: new Set(), wineNames: new Set() };
      channelStats[bt].qty += qty;
      channelStats[bt].correctedQty += correctedQty;
      channelStats[bt].clients.add(s.client_name);
      channelStats[bt].wineNames.add(wineName);
    }

    const years = Object.entries(yearMap).filter(([, v]) => v.qty >= 6);
    if (years.length === 0) continue;

    const sortedYears = years.sort(([a], [b]) => a.localeCompare(b));
    const maxYr = Math.max(...sortedYears.map(([yr]) => Number(yr)));
    const getWeight = (yr: string) => {
      const diff = maxYr - Number(yr);
      return diff === 0 ? 3 : diff === 1 ? 2 : 1;
    };
    const totalWeight = sortedYears.reduce((s, [yr]) => s + getWeight(yr), 0);

    const avgQtyRaw = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.qty * getWeight(yr), 0) / totalWeight);
    const avgQtyCorrected = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.correctedQty * getWeight(yr), 0) / totalWeight);
    const avgWines = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.wineNames.size * getWeight(yr), 0) / totalWeight);
    const avgClients = Math.round(sortedYears.reduce((s, [yr, v]) => s + v.clients.size * getWeight(yr), 0) / totalWeight);

    const divisor = isNewItem ? avgWines + 1 : avgWines;
    const qtyPerItemRaw = divisor > 0 ? Math.round(avgQtyRaw / divisor) : 0;
    const qtyPerItem = divisor > 0 ? Math.round(avgQtyCorrected / divisor) : 0;
    const qtyPerItemYear1 = learningCurve ? Math.round(qtyPerItem * learningCurve.ratio) : null;

    // 와인별 분포 통계 (유사 와인 성과 참조용)
    const perWineAnnuals = Object.values(wineStats)
      .map(v => Math.round(v.correctedQty / Math.max(v.years.size, 1)))
      .filter(v => v >= 6)
      .sort((a, b) => a - b);
    const median = perWineAnnuals.length > 0 ? perWineAnnuals[Math.floor(perWineAnnuals.length / 2)] : 0;
    const p25 = perWineAnnuals.length >= 4 ? perWineAnnuals[Math.floor(perWineAnnuals.length * 0.25)] : perWineAnnuals[0] || 0;
    const p75 = perWineAnnuals.length >= 4 ? perWineAnnuals[Math.floor(perWineAnnuals.length * 0.75)] : perWineAnnuals[perWineAnnuals.length - 1] || 0;

    const yearDetails = sortedYears.map(([yr]) => {
      const v = yearMap[yr];
      return {
        year: yr, qty: v.qty, correctedQty: v.correctedQty,
        items: v.wineNames.size, clients: v.clients.size,
        qtyPerItem: v.wineNames.size > 0 ? Math.round(v.qty / (isNewItem ? v.wineNames.size + 1 : v.wineNames.size)) : 0,
        qtyPerItemCorrected: v.wineNames.size > 0 ? Math.round(v.correctedQty / (isNewItem ? v.wineNames.size + 1 : v.wineNames.size)) : 0,
      };
    });

    const wineDetails = Object.entries(wineStats)
      .sort(([, a], [, b]) => b.qty - a.qty)
      .map(([name, v]) => ({
        item_code: [...v.codes].join(', '),
        item_name: name,
        supply_price: v.totalListQty > 0 ? Math.round(v.totalListAmt / v.totalListQty) : v.price,
        avg_import_cost: v.importCost,
        avg_selling_price: v.totalUnitQty > 0 ? Math.round(v.totalUnitAmt / v.totalUnitQty) : v.price,
        region: wineMap[[...v.codes][0]]?.region || null,
        total_qty: v.qty,
        corrected_qty: v.correctedQty,
        stockout_factor: Math.round((stockoutCorrections[name]?.factor || 1) * 100) / 100,
        client_count: v.clients.size,
        years_sold: v.years.size,
        annual_avg: Math.round(v.qty / v.years.size),
        annual_avg_corrected: Math.round(v.correctedQty / v.years.size),
      }));

    const topClients = Object.entries(clientStats)
      .sort(([, a], [, b]) => b.qty - a.qty)
      .slice(0, 10)
      .map(([name, v]) => ({
        client_name: name,
        total_qty: v.qty,
        item_count: v.wineNames.size,
        business_type: clientBusinessType[name] || '(미분류)',
      }));

    const yearsCount = Math.max(years.length, 1);
    const channels = Object.entries(channelStats)
      .map(([channel, v]) => ({
        channel,
        qty: v.correctedQty,
        annual_qty: Math.round(v.correctedQty / yearsCount),
        clients: v.clients.size,
        wines: v.wineNames.size,
        qty_per_wine: v.wineNames.size > 0 ? Math.round(v.correctedQty / yearsCount / (isNewItem ? v.wineNames.size + 1 : v.wineNames.size)) : 0,
        pct: 0,
      }))
      .filter(c => c.qty > 0)
      .sort((a, b) => b.qty - a.qty);
    const totalChQty = channels.reduce((s, c) => s + c.qty, 0);
    channels.forEach(c => { c.pct = totalChQty > 0 ? Math.round(c.qty / totalChQty * 100) : 0; });

    results.push({
      manager,
      years_active: years.length,
      avg_annual_qty: avgQtyRaw,
      avg_annual_qty_corrected: avgQtyCorrected,
      avg_items: avgWines,
      qty_per_item_raw: qtyPerItemRaw,
      qty_per_item: qtyPerItem,
      qty_per_item_year1: qtyPerItemYear1,
      avg_clients: avgClients,
      min_qty: Math.min(...years.map(([, v]) => v.qty)),
      max_qty: Math.max(...years.map(([, v]) => v.qty)),
      wine_distribution: { median, p25, p75, count: perWineAnnuals.length },
      channels,
      year_details: yearDetails,
      wine_details: wineDetails,
      top_clients: topClients,
    });
  }

  results.sort((a, b) => b.avg_annual_qty - a.avg_annual_qty);
  return results;
}

export type { ManagerResult };
