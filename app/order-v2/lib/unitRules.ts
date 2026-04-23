import type { OrderTab } from "../types";

/**
 * 품목 단위 결정 규칙.
 * - CDV: 항상 "병"
 * - DL: 품명에 "디캔터" → "개"
 *       품명에 "레스토랑" 포함 또는 `0xxx/x` 형식(레스토랑 시리즈) → "잔"
 *       그 외 전부 "개" (6449, 6884, 4400 등 일반 시리즈 + 박스/쇼핑백)
 */
export function getUnit(
  tab: OrderTab,
  _itemNo?: string,
  itemName?: string,
): "병" | "잔" | "개" {
  if (tab !== "DL") return "병";
  const name = itemName || "";

  if (/디캔터/i.test(name)) return "개";
  if (/레스토랑/i.test(name)) return "잔";
  if (/\b0\d{3}\/\d/.test(name)) return "잔";

  return "개";
}
