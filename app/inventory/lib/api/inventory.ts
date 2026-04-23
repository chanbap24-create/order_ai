import type { AdvancedFilters, InventoryItem, WarehouseTab } from "../../types";

/** 국가 목록 */
export async function fetchCountries(tab: WarehouseTab): Promise<string[]> {
  try {
    const res = await fetch(`/api/inventory/countries?tab=${tab}`);
    const json = await res.json();
    return json.countries || [];
  } catch {
    return [];
  }
}

/** 텍스트 검색 (CDV/DL 분기) */
export async function searchInventoryByText(
  q: string,
  tab: WarehouseTab,
): Promise<InventoryItem[]> {
  const url =
    tab === "CDV"
      ? `/api/inventory/search?q=${encodeURIComponent(q)}`
      : `/api/inventory/dl/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("검색 중 오류가 발생했습니다.");
  const json = await res.json();
  return json.results || [];
}

/** 중첩된 AdvancedFilters → 평탄한 query params 변환 */
function flattenFilters(f: AdvancedFilters, tab: WarehouseTab): URLSearchParams {
  const p = new URLSearchParams();
  p.set("tab", tab);

  const ranges: Array<[keyof AdvancedFilters, string]> = [
    ["stock", "stock"],
    ["sales30", "sales30"],
    ["sales90", "sales90"],
    ["vintage", "vintage"],
    ["supplyPrice", "supplyPrice"],
    ["retailPrice", "retailPrice"],
    ["minPrice", "minPrice"],
  ];
  for (const [field, prefix] of ranges) {
    const r = f[field] as { enabled: boolean; min: string; max: string };
    if (!r.enabled) continue;
    if (r.min) p.set(`${prefix}Min`, r.min);
    if (r.max) p.set(`${prefix}Max`, r.max);
  }
  if (f.category.enabled && f.category.value) p.set("category", f.category.value);
  if (f.country.enabled && f.country.value) p.set("country", f.country.value);
  return p;
}

/** 고급 필터 검색 */
export async function searchInventoryByFilter(
  filters: AdvancedFilters,
  tab: WarehouseTab,
): Promise<InventoryItem[]> {
  const params = flattenFilters(filters, tab);
  const res = await fetch(`/api/inventory/filter?${params.toString()}`);
  if (!res.ok) throw new Error("검색 중 오류가 발생했습니다.");
  const json = await res.json();
  return json.results || [];
}
