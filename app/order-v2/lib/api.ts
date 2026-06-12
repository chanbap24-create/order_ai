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

/**
 * 정정 학습: 최종 선택이 파싱 1순위(llm_top_item_no)와 다른 라인을
 * "발주표현(query) → 선택 품번(item_no)" 별칭으로 학습한다.
 * 기존 /api/learn-item-alias 재사용(item_alias + token_mapping + ml_training_data).
 * fire-and-forget — 복사/확정 흐름을 막지 않는다.
 */
export function learnOrderCorrections(lines: OrderLine[]): void {
  const isLearnable = (q: string) => q.trim().length >= 2 && !/^\d+$/.test(q.trim());
  const corrections = lines
    .map((ol) => {
      const sel = ol.selectedIdx >= 0 ? ol.candidates[ol.selectedIdx] : undefined;
      if (!sel || !ol.llm_top_item_no) return null;
      if (sel.item_no === ol.llm_top_item_no) return null;      // 정답이었음
      if (!isLearnable(ol.query)) return null;                  // 약한 신호
      if (ol.query.trim() === (sel.item_name || "").trim()) return null; // 입고내역 직접추가 등
      return { alias: ol.query.trim(), canonical: sel.item_no };
    })
    .filter((c): c is { alias: string; canonical: string } => c !== null);

  if (corrections.length === 0) return;
  void Promise.allSettled(
    corrections.map((c) =>
      fetch("/api/learn-item-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 와인명 별칭은 거래처 무관 전역 매핑(*)으로 학습 — orderReviewer가 전역으로 읽음
        body: JSON.stringify({ alias: c.alias, canonical: c.canonical, client_code: "*" }),
      }).catch(() => {}),
    ),
  );
}
// client_code 는 전역 별칭으로 학습(거래처별 학습은 후속 과제)

export type IntakeResult = { client_hint: string; order_text: string; found: boolean };

/** 카톡 스크린샷(base64) → 거래처힌트 + 발주텍스트 추출 */
export async function extractFromImage(
  imageData: string,
  mediaType: string,
): Promise<IntakeResult & { error?: string }> {
  const res = await fetch("/api/order-v2/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_data: imageData, media_type: mediaType }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "이미지 분석 실패");
  return json;
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
    // 학습 기준선: 파싱 후 기본 선택(1순위) 품번. 최종 선택이 이와 다르면 정정.
    llm_top_item_no: ol.candidates?.[0]?.item_no,
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
