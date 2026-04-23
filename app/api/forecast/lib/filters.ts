import type { Shipment } from "./types";

export type BulkInfo = {
  count: number;
  qty: number;
  details: { date: string; client: string; wine: string; qty: number; manager: string }[];
};

export function applyBulkFilter(
  shipments: Shipment[],
  analysisStart: string,
  analysisEnd: string,
  bulkThreshold: number,
  getWineName: (itemNo: string) => string,
): { shipments: Shipment[]; info: BulkInfo } {
  const dayClientWine: Record<string, { total: number; indices: number[]; client: string; wine: string; date: string; manager: string }> = {};

  for (let i = 0; i < shipments.length; i++) {
    const s = shipments[i];
    if (s.ship_date < analysisStart || s.ship_date > analysisEnd) continue;
    const wineName = getWineName(s.item_no);
    const key = `${s.ship_date}|${s.client_name}|${wineName}`;
    if (!dayClientWine[key]) {
      dayClientWine[key] = { total: 0, indices: [], client: s.client_name, wine: wineName, date: s.ship_date, manager: s.manager };
    }
    dayClientWine[key].total += s.quantity || 0;
    dayClientWine[key].indices.push(i);
  }

  const bulkIndices = new Set<number>();
  let count = 0, qty = 0;
  const details: BulkInfo['details'] = [];

  for (const v of Object.values(dayClientWine)) {
    if (v.total >= bulkThreshold) {
      for (const idx of v.indices) bulkIndices.add(idx);
      count++;
      qty += v.total;
      details.push({ date: v.date, client: v.client, wine: v.wine, qty: v.total, manager: v.manager });
    }
  }
  details.sort((a, b) => b.date.localeCompare(a.date));

  const filtered = bulkIndices.size > 0 ? shipments.filter((_, i) => !bulkIndices.has(i)) : shipments;
  return { shipments: filtered, info: { count, qty, details } };
}

export type SampleInfo = { count: number; qty: number };

export function applySampleFilter(
  shipments: Shipment[],
  analysisStart: string,
  analysisEnd: string,
  getWineName: (itemNo: string) => string,
): { shipments: Shipment[]; info: SampleInfo } {
  const sampleIndices = new Set<number>();
  let count = 0, qty = 0;

  // 1) 출고가 0원인 건 제외 (무상 샘플)
  for (let i = 0; i < shipments.length; i++) {
    const s = shipments[i];
    if (s.ship_date < analysisStart || s.ship_date > analysisEnd) continue;
    const sell = s.selling_price || 0;
    const unit = s.unit_price || 0;
    if (sell === 0 && unit === 0 && (s.quantity || 0) > 0) {
      sampleIndices.add(i);
      count++;
      qty += s.quantity || 0;
    }
  }

  // 2) 거래처별 1병만 출고되고 재주문 없는 건
  const clientWineQty: Record<string, { total: number; indices: number[] }> = {};
  for (let i = 0; i < shipments.length; i++) {
    if (sampleIndices.has(i)) continue;
    const s = shipments[i];
    if (s.ship_date < analysisStart || s.ship_date > analysisEnd) continue;
    const wineName = getWineName(s.item_no);
    const key = `${s.client_name}|${wineName}`;
    if (!clientWineQty[key]) clientWineQty[key] = { total: 0, indices: [] };
    clientWineQty[key].total += s.quantity || 0;
    clientWineQty[key].indices.push(i);
  }
  for (const v of Object.values(clientWineQty)) {
    if (v.total === 1) {
      for (const idx of v.indices) sampleIndices.add(idx);
      count++;
      qty += v.total;
    }
  }

  const filtered = sampleIndices.size > 0 ? shipments.filter((_, i) => !sampleIndices.has(i)) : shipments;
  return { shipments: filtered, info: { count, qty } };
}

export function buildMonthlyYearlySeries(
  shipments: Shipment[],
  dateFrom: string,
  dateTo: string,
) {
  const monthlyData: Record<string, { qty: number; amount: number }> = {};
  const yearlyData: Record<string, { qty: number; amount: number }> = {};
  for (const s of shipments) {
    if (s.ship_date < dateFrom || s.ship_date > dateTo) continue;
    const qty = s.quantity || 0;
    if (qty <= 0) continue;
    const isNewFormat = s.ship_date >= '2025-08-01';
    const amount = isNewFormat
      ? (s.supply_amount || 0)
      : (s.selling_price || s.supply_amount || 0);
    const ym = s.ship_date.slice(0, 7);
    const yr = s.ship_date.slice(0, 4);
    if (!monthlyData[ym]) monthlyData[ym] = { qty: 0, amount: 0 };
    monthlyData[ym].qty += qty;
    monthlyData[ym].amount += amount;
    if (!yearlyData[yr]) yearlyData[yr] = { qty: 0, amount: 0 };
    yearlyData[yr].qty += qty;
    yearlyData[yr].amount += amount;
  }
  const monthlySeries = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, qty: d.qty, amount: d.amount }));
  const yearlySeries = Object.entries(yearlyData).sort(([a], [b]) => a.localeCompare(b)).map(([year, d]) => ({ year, qty: d.qty, amount: d.amount }));
  return { monthlySeries, yearlySeries };
}
