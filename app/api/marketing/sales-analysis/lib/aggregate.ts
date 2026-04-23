import { WINE_CODES, inferVolume } from './constants';
import {
  REGION_GROUPS, SUB_REGION_GROUPS,
  matchRegionGroup, resolveRegionGroup, resolveSubRegion,
} from './regionGroups';
import { resolveWine, type ResolvedWine } from './wineResolver';
import type { ShipmentRow } from './shipmentFetcher';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WineRow = any;

type Filters = {
  country: string;
  region: string;
  type: string;
  volume: string;
  subRegion: string;
  brand: string;
};

type ItemAgg = {
  item_no: string;
  item_name: string;
  qty: number;
  amount: number;
  country: string;
  region: string | null;
  wineType: string | null;
  brandCode: string | null;
};

export type AggregateResult = {
  itemAgg: Record<string, ItemAgg>;
  monthlyQty: Record<string, number>;
  totalQty: number;
  matchedCountry: number;
  matchedRegion: number;
  matchedType: number;
};

/**
 * 출고 행 → (item_agg + monthly_qty + match_rate) 집계.
 * 필터를 통과한 행만 포함.
 */
export function aggregateShipments(
  allShipments: ShipmentRow[],
  wineMap: Map<string, WineRow>,
  invMap: Map<string, string>,
  brandCountry: Map<string, string>,
  vintageMap: Map<string, { abbr: string; data: WineRow }[]>,
  filters: Filters,
): AggregateResult {
  const resolveCache = new Map<string, ResolvedWine>();
  const itemAgg: Record<string, ItemAgg> = {};
  const monthlyQty: Record<string, number> = {};

  let totalQty = 0, matchedCountry = 0, matchedRegion = 0, matchedType = 0;

  for (const r of allShipments) {
    if (!r.item_no || r.item_no.length < 5) continue;
    const firstChar = r.item_no.charAt(0).toUpperCase();
    if (!WINE_CODES.has(firstChar)) continue;
    const qty = r.quantity || 0;
    const absQty = Math.abs(qty);
    if (qty === 0) continue;

    let resolved = resolveCache.get(r.item_no);
    if (!resolved) {
      resolved = resolveWine(r.item_no, r.item_name || '', wineMap, invMap, brandCountry, vintageMap);
      resolveCache.set(r.item_no, resolved);
    }
    const { country, region, wineType, brandCode } = resolved;

    // 필터 적용
    if (filters.brand && brandCode !== filters.brand) continue;
    if (filters.country && country !== filters.country) continue;
    if (filters.region && country) {
      if (!region) continue;
      const groups = REGION_GROUPS[country];
      const group = groups?.find((g) => g.label === filters.region);
      if (group) {
        if (!matchRegionGroup(region, group.keywords)) continue;
      } else if (!region.toLowerCase().includes(filters.region.toLowerCase())) {
        continue;
      }
    }
    if (filters.type && wineType !== filters.type) continue;
    if (filters.volume && inferVolume(r.item_name || '') !== filters.volume) continue;
    if (filters.subRegion && country && region) {
      const regionGroup = resolveRegionGroup(country, region);
      const subs = SUB_REGION_GROUPS[country]?.[regionGroup];
      if (!subs) continue;
      const sub = subs.find((s) => s.label === filters.subRegion);
      if (!sub) continue;
      if (!matchRegionGroup(region, sub.keywords)) continue;
    }

    // 매출 = 공급가액 (시기별 컬럼 차이)
    const isNewFormat = r.ship_date >= '2025-08-01';
    const amount = isNewFormat
      ? (r.supply_amount || 0)
      : (r.selling_price || r.supply_amount || 0);

    totalQty += qty;
    if (country) matchedCountry += absQty;
    if (region) matchedRegion += absQty;
    if (wineType) matchedType += absQty;

    const month = (r.ship_date || '').slice(0, 7);
    monthlyQty[month] = (monthlyQty[month] || 0) + qty;

    const key = r.item_no;
    if (!itemAgg[key]) {
      itemAgg[key] = {
        item_no: r.item_no, item_name: r.item_name || '',
        qty: 0, amount: 0,
        country: country || '', region, wineType, brandCode,
      };
    }
    itemAgg[key].qty += qty;
    itemAgg[key].amount += amount;
  }

  return { itemAgg, monthlyQty, totalQty, matchedCountry, matchedRegion, matchedType };
}

/**
 * item 단위 집계로부터 country/region/type/topItems 최종 그룹 생성.
 */
export function buildGroupedResults(
  itemAgg: Record<string, ItemAgg>,
  filterRegion: string,
  brandNameMap: Map<string, string>,
) {
  const countryAgg: Record<string, { qty: number; amount: number; items: number; types: Record<string, number> }> = {};
  const regionAgg: Record<string, Record<string, { qty: number; amount: number }>> = {};
  const typeAgg: Record<string, { qty: number; amount: number }> = {};
  let totalAmount = 0;

  for (const item of Object.values(itemAgg)) {
    if (item.qty <= 0) continue;
    totalAmount += item.amount;

    if (item.country) {
      if (!countryAgg[item.country]) {
        countryAgg[item.country] = { qty: 0, amount: 0, items: 0, types: {} };
      }
      countryAgg[item.country].qty += item.qty;
      countryAgg[item.country].amount += item.amount;
      countryAgg[item.country].items += 1;
      if (item.wineType) {
        countryAgg[item.country].types[item.wineType] =
          (countryAgg[item.country].types[item.wineType] || 0) + item.qty;
      }
      if (item.region) {
        if (!regionAgg[item.country]) regionAgg[item.country] = {};
        const groupLabel = resolveRegionGroup(item.country, item.region);
        const displayLabel = filterRegion
          ? resolveSubRegion(item.country, groupLabel, item.region)
          : groupLabel;
        if (!regionAgg[item.country][displayLabel]) {
          regionAgg[item.country][displayLabel] = { qty: 0, amount: 0 };
        }
        regionAgg[item.country][displayLabel].qty += item.qty;
        regionAgg[item.country][displayLabel].amount += item.amount;
      }
    }
    if (item.wineType) {
      if (!typeAgg[item.wineType]) typeAgg[item.wineType] = { qty: 0, amount: 0 };
      typeAgg[item.wineType].qty += item.qty;
      typeAgg[item.wineType].amount += item.amount;
    }
  }

  const countries = Object.entries(countryAgg)
    .map(([name, d]) => ({
      name, qty: d.qty, amount: d.amount, items: d.items,
      avg_price: d.qty > 0 ? Math.round(d.amount / d.qty) : 0,
      types: Object.entries(d.types).map(([t, q]) => ({ name: t, qty: q })).sort((a, b) => b.qty - a.qty),
    }))
    .sort((a, b) => b.qty - a.qty);

  const regions: Record<string, { name: string; qty: number; amount: number; avg_price: number }[]> = {};
  for (const [c, regs] of Object.entries(regionAgg)) {
    regions[c] = Object.entries(regs)
      .map(([name, d]) => ({
        name, qty: d.qty, amount: d.amount,
        avg_price: d.qty > 0 ? Math.round(d.amount / d.qty) : 0,
      }))
      .sort((a, b) => b.qty - a.qty);
  }

  const types = Object.entries(typeAgg)
    .map(([name, d]) => ({
      name, qty: d.qty, amount: d.amount,
      avg_price: d.qty > 0 ? Math.round(d.amount / d.qty) : 0,
    }))
    .sort((a, b) => b.qty - a.qty);

  const topItems = Object.values(itemAgg).filter((i) => i.qty > 0).sort((a, b) => b.qty - a.qty)
    .map(({ item_no, item_name, qty, amount, country, region, wineType, brandCode }) => ({
      item_no, item_name, qty, amount,
      avg_price: qty > 0 ? Math.round(amount / qty) : 0,
      country,
      region: region ? resolveRegionGroup(country || '', region) : null,
      wine_type: wineType,
      brand_code: brandCode,
      brand_name: brandCode ? (brandNameMap.get(brandCode) || brandCode) : null,
    }));

  return { countries, regions, types, topItems, totalAmount };
}
