import type { InventoryItem, QuoteItem, WarehouseTab, WineProfile } from "../../types";

type ManagerParams = { tab: WarehouseTab; manager: string };

function qp({ tab, manager }: ManagerParams): string {
  const p = new URLSearchParams({ tab });
  if (manager) p.set("manager", manager);
  return p.toString();
}

/** 현재 견적서 전체 조회 */
export async function fetchQuoteItems(params: ManagerParams): Promise<QuoteItem[]> {
  const res = await fetch(`/api/quote?${qp(params)}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.items || [];
}

/** 견적에 품목 추가 (재고에서 선택된 항목 기반) */
export async function addQuoteItem(
  item: InventoryItem,
  params: ManagerParams,
): Promise<QuoteItem | null> {
  const res = await fetch(`/api/quote?${qp(params)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.item || null;
}

/** 견적 항목 수정 */
export async function updateQuoteItem(
  id: number,
  patch: Partial<QuoteItem>,
  params: ManagerParams,
): Promise<boolean> {
  const res = await fetch(`/api/quote?${qp(params)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  return res.ok;
}

/** 견적 항목 순서 변경 */
export async function reorderQuoteItem(
  id: number,
  newOrder: number,
  params: ManagerParams,
): Promise<boolean> {
  const res = await fetch(`/api/quote?${qp(params)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch: { sort_order: newOrder } }),
  });
  return res.ok;
}

/** 견적 항목 삭제 */
export async function deleteQuoteItem(
  id: number,
  params: ManagerParams,
): Promise<boolean> {
  const res = await fetch(
    `/api/quote?${qp(params)}&id=${encodeURIComponent(String(id))}`,
    { method: "DELETE" },
  );
  return res.ok;
}

/** 견적 전체 삭제 */
export async function clearAllQuote(params: ManagerParams): Promise<boolean> {
  const res = await fetch(`/api/quote?${qp(params)}&all=1`, { method: "DELETE" });
  return res.ok;
}

/** 와인 프로필(포도품종/설명) 조회 */
export async function fetchWineProfiles(
  itemCodes: string[],
): Promise<Record<string, WineProfile>> {
  if (itemCodes.length === 0) return {};
  const res = await fetch(
    `/api/wine-profiles?codes=${encodeURIComponent(itemCodes.join(","))}`,
  );
  if (!res.ok) return {};
  const json = await res.json();
  return json.profiles || {};
}
