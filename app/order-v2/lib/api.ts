import type {
  Client,
  HistoryItem,
  OrderLine,
  OrderTab,
  ParseUsage,
  SearchResult,
} from "../types";

/** 연간 휴일 YYYY-MM-DD set */
export async function fetchHolidays(year: number): Promise<Set<string>> {
  try {
    const res = await fetch(`/api/sales/holidays?year=${year}`);
    const json = await res.json();
    return new Set(Object.keys(json.holidays || {}));
  } catch {
    return new Set();
  }
}

/** 거래처 검색 (AbortSignal 지원) */
export async function fetchClients(
  q: string,
  tab: OrderTab,
  signal?: AbortSignal,
): Promise<Client[]> {
  const url = `/api/order-v2/clients?q=${encodeURIComponent(q)}&tab=${tab}`;
  const res = await fetch(url, { signal });
  const json = await res.json();
  return json.clients || [];
}

/** 거래처 입고내역 */
export async function fetchClientHistory(
  clientCode: string,
  tab: OrderTab,
): Promise<HistoryItem[]> {
  const url = `/api/order-v2/history?client_code=${encodeURIComponent(clientCode)}&tab=${tab}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.items || [];
}

/** 와인/글라스 수동 검색 */
export async function searchWines(q: string, tab: OrderTab): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const url = `/api/order-v2/search?q=${encodeURIComponent(q)}&tab=${tab}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.results || [];
}

export type ParseOrderResult = {
  orderLines: OrderLine[];
  usage: ParseUsage | null;
  historyItemNos: string[];
};

/** 발주 텍스트 파싱 */
export async function parseOrder(params: {
  clientCode: string;
  clientName: string;
  orderText: string;
  tab: OrderTab;
}): Promise<ParseOrderResult> {
  const res = await fetch("/api/order-v2/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_code: params.clientCode,
      client_name: params.clientName,
      order_text: params.orderText,
      tab: params.tab,
    }),
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || "파싱 실패");
  }

  const lines: OrderLine[] = (json.orderLines || []).map((ol: any) => ({
    query: ol.query || "",
    quantity: ol.quantity || 1,
    candidates: ol.candidates || [],
    selectedIdx: ol.candidates?.length > 0 ? 0 : -1,
    ...(ol.qty_warning
      ? { qty_warning: ol.qty_warning, qty_original_llm: ol.qty_original_llm }
      : {}),
    ...(ol.review_note ? { review_note: ol.review_note } : {}),
  }));

  return {
    orderLines: lines,
    usage: json.usage || null,
    historyItemNos: json.historyItemNos || [],
  };
}
