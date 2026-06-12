import { useCallback, useState } from "react";
import { extractFromImage, fetchClients, parseOrder } from "../lib/api";
import { pickClientMatch } from "../lib/clientMatch";
import { fileToBase64 } from "../lib/imageFile";
import type { BatchOrder, BatchStatus, Client, OrderLine, OrderTab } from "../types";

const CONCURRENCY = 3;

/** 후보/거래처 상태로 카드 status 산출 */
function computeStatus(client: Client | null, lines: OrderLine[]): BatchStatus {
  if (!client) return "needs_client";
  const shaky = lines.some((ol) => {
    if (ol.candidates.length === 0 || ol.selectedIdx < 0) return true;
    const sel = ol.candidates[ol.selectedIdx];
    if (sel && sel.confidence < 0.7) return true;
    return (ol.review_note || "").startsWith("⚠");
  });
  return shaky ? "needs_review" : "ready";
}

/** 단일 파일 처리: 추출 → 거래처매칭 → 파싱 */
async function processOne(file: File, tab: OrderTab): Promise<Omit<BatchOrder, "id" | "fileName">> {
  const { data, mediaType } = await fileToBase64(file);
  const extracted = await extractFromImage(data, mediaType);
  if (!extracted.found) {
    return {
      clientHint: extracted.client_hint || "",
      client: null, clientOptions: [], orderText: extracted.order_text || "",
      orderLines: [], historySet: new Set(),
      status: "error", error: extracted.error || "발주 내용을 찾지 못했습니다.",
    };
  }

  // 거래처 매칭
  let client: Client | null = null;
  let clientOptions: Client[] = [];
  if (extracted.client_hint) {
    try {
      clientOptions = await fetchClients(extracted.client_hint, tab);
      client = pickClientMatch(extracted.client_hint, clientOptions);
    } catch { /* 매칭 실패 → needs_client */ }
  }

  // 발주 파싱 (기존 파이프라인 재사용)
  const parsed = await parseOrder({
    clientCode: client?.client_code || "",
    clientName: client?.client_name || extracted.client_hint || "",
    orderText: extracted.order_text,
    tab,
  });

  return {
    clientHint: extracted.client_hint,
    client,
    clientOptions,
    orderText: extracted.order_text,
    orderLines: parsed.orderLines,
    historySet: new Set(parsed.historyItemNos.map((n) => n.trim().toUpperCase())),
    status: computeStatus(client, parsed.orderLines),
  };
}

/** 발주 인박스(배치) 상태 + 처리 */
export function useOrderBatch() {
  const [orders, setOrders] = useState<BatchOrder[]>([]);
  const [processing, setProcessing] = useState(false);

  const patch = useCallback((id: string, p: Partial<BatchOrder>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)));
  }, []);

  const start = useCallback(async (files: File[], tab: OrderTab) => {
    const base = Date.now();
    const initial: BatchOrder[] = files.map((f, i) => ({
      id: `b${base}-${i}`, fileName: f.name || `스샷 ${i + 1}`,
      clientHint: "", client: null, clientOptions: [], orderText: "",
      orderLines: [], historySet: new Set(), status: "extracting",
    }));
    setOrders((prev) => [...prev, ...initial]);
    setProcessing(true);

    // 동시성 제한 풀
    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const i = cursor++;
        const id = initial[i].id;
        try {
          const result = await processOne(files[i], tab);
          patch(id, result);
        } catch (e) {
          patch(id, { status: "error", error: e instanceof Error ? e.message : "처리 실패" });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    setProcessing(false);
  }, [patch]);

  // ── 카드별 편집 ──
  const selectCandidate = useCallback((id: string, lineIdx: number, candIdx: number) => {
    setOrders((prev) => prev.map((o) => {
      if (o.id !== id) return o;
      const orderLines = o.orderLines.map((ol, i) => (i === lineIdx ? { ...ol, selectedIdx: candIdx } : ol));
      return { ...o, orderLines, status: computeStatus(o.client, orderLines) };
    }));
  }, []);

  const setQuantity = useCallback((id: string, lineIdx: number, qty: number) => {
    if (qty < 1) return;
    setOrders((prev) => prev.map((o) => o.id !== id ? o
      : { ...o, orderLines: o.orderLines.map((ol, i) => (i === lineIdx ? { ...ol, quantity: qty } : ol)) }));
  }, []);

  const setClient = useCallback((id: string, client: Client) => {
    setOrders((prev) => prev.map((o) => o.id !== id ? o
      : { ...o, client, status: computeStatus(client, o.orderLines) }));
  }, []);

  const removeOrder = useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const clear = useCallback(() => setOrders([]), []);

  return { orders, processing, start, selectCandidate, setQuantity, setClient, removeOrder, clear };
}
