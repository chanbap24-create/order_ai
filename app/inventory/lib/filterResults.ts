import { getItemCategory } from "../constants/categories";
import type { AdvancedFilters, InventoryItem, WarehouseTab } from "../types";
import type { ImportScheduleItem } from "../hooks/useImportSchedule";

type Params = {
  results: InventoryItem[];
  activeTab: WarehouseTab;
  hideNoSupplyPrice: boolean;
  hideNoStock: boolean;
  showOnlyBondedStock: boolean;
  advancedFilters: AdvancedFilters;
  importScheduleMap: Record<string, ImportScheduleItem[]>;
};

/** 서버에서 받아온 검색 결과에 클라이언트 측 필터(칩 + 고급 필터)를 적용한다. */
export function applyClientFilters(p: Params): InventoryItem[] {
  const f = p.advancedFilters;
  return p.results.filter((item) => {
    if (
      p.hideNoSupplyPrice &&
      (!item.supply_price || item.supply_price <= 0) &&
      !p.importScheduleMap[item.item_no]
    )
      return false;

    if (p.activeTab === "CDV" && p.showOnlyBondedStock) {
      const hasNoStock = !item.total_stock || item.total_stock <= 0;
      const hasBondedStock = item.bonded_warehouse && item.bonded_warehouse > 0;
      return Boolean(hasNoStock && hasBondedStock);
    }
    if (
      p.hideNoStock &&
      (!item.total_stock || item.total_stock <= 0) &&
      !p.importScheduleMap[item.item_no]
    )
      return false;

    const inRange = (
      v: number,
      enabled: boolean,
      min: string,
      max: string,
    ): boolean => {
      if (!enabled) return true;
      const lo = min !== "" ? Number(min) : null;
      const hi = max !== "" ? Number(max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
      return true;
    };

    if (
      !inRange(
        (item.available_stock || 0) + (item.bonded_warehouse || 0),
        f.stock.enabled,
        f.stock.min,
        f.stock.max,
      )
    )
      return false;
    if (!inRange(item.sales_30days || 0, f.sales30.enabled, f.sales30.min, f.sales30.max))
      return false;
    if (!inRange(item.avg_sales_90d || 0, f.sales90.enabled, f.sales90.min, f.sales90.max))
      return false;

    if (f.vintage.enabled) {
      const v = parseInt(item.vintage);
      if (!isNaN(v) && !inRange(v, true, f.vintage.min, f.vintage.max)) return false;
    }

    if (
      !inRange(
        item.supply_price || 0,
        f.supplyPrice.enabled,
        f.supplyPrice.min,
        f.supplyPrice.max,
      )
    )
      return false;
    if (
      !inRange(
        item.retail_price || 0,
        f.retailPrice.enabled,
        f.retailPrice.min,
        f.retailPrice.max,
      )
    )
      return false;
    if (!inRange(item.min_price || 0, f.minPrice.enabled, f.minPrice.min, f.minPrice.max))
      return false;

    if (f.category?.enabled && f.category?.value) {
      if (getItemCategory(item.item_no) !== f.category.value) return false;
    }
    if (f.country.enabled && f.country.value) {
      if ((item.country || "") !== f.country.value) return false;
    }
    return true;
  });
}
