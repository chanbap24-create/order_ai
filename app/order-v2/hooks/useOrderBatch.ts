import { useCallback, useEffect, useRef, useState } from "react";
import { extractFromImage, fetchClients, learnOrderCorrections, parseOrder } from "../lib/api";
import { buildBatchAllMessage } from "../lib/batchMessage";
import { pickClientWithFuzzy } from "../lib/clientMatch";
import { isLineShaky } from "../lib/confidence";
import { fileToBase64 } from "../lib/imageFile";
import type { BatchOrder, BatchStatus, Client, OrderLine, OrderTab } from "../types";

/** 자동 발주 결과: 전부 확실하면 자동 복사, 아니면 확인필요 건수 안내 */
export type AutoResult = { total: number; ready: number; attention: number; copied: boolean; message: string };

const CONCURRENCY = 3;

/** 후보/거래처 상태로 카드 status 산출 */
function computeStatus(client: Client | null, lines: OrderLine[]): BatchStatus {
  if (!client) return "needs_client";
  return lines.some(isLineShaky) ? "needs_review" : "ready";
}

/** 단일 파일 처리: 추출 → 거래처매칭 → 파싱 */
async function processOne(file: File, tab: OrderTab): Promise<Omit<BatchOrder, "id" | "fileName">> {
  const { data, mediaType } = await fileToBase64(file);
  const extracted = await extractFromImage(data, mediaType, tab);
  if (!extracted.found) {
    return {
      clientHint: extracted.client_hint || "",
      client: null, clientOptions: [], orderText: extracted.order_text || "",
      orderLines: [], historySet: new Set(),
      status: "error", error: extracted.error || "발주 내용을 찾지 못했습니다.",
    };
  }

  // 거래처 매칭 — LLM이 담당자 거래처에서 고른 코드가 확신 높으면 우선, 아니면 힌트 퍼지
  let client: Client | null = null;
  let clientOptions: Client[] = [];
  if (extracted.client_code && extracted.client_name && (extracted.client_confidence ?? 0) >= 0.75) {
    client = { client_code: extracted.client_code, client_name: extracted.client_name } as Client;
  }
  if (!client && extracted.client_hint) {
    try {
      clientOptions = await fetchClients(extracted.client_hint, tab);
      client = pickClientWithFuzzy(extracted.client_hint, clientOptions);
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
  // 자동 발주: 처리 완료 후 불확정 0 이면 자동 복사
  const autoRef = useRef(false);
  const autoTabRef = useRef<OrderTab>("CDV");
  const [autoResult, setAutoResult] = useState<AutoResult | null>(null);
  const clearAutoResult = useCallback(() => setAutoResult(null), []);

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

  /** 자동 발주: 장수 무관 배치 파이프라인 실행 → 완료 시 자동 마무리(아래 effect) */
  const startAuto = useCallback((files: File[], tab: OrderTab) => {
    if (files.length === 0) return;
    autoRef.current = true;
    autoTabRef.current = tab;
    setAutoResult(null);
    void start(files, tab);
  }, [start]);

  // 처리 완료 감지 → 자동 마무리. 불확정 0 이면 전체 복사 + 학습, 아니면 검토 안내만.
  useEffect(() => {
    if (!autoRef.current || processing || orders.length === 0) return;
    const pending = orders.some((o) => o.status === "extracting" || o.status === "parsing");
    if (pending) return;
    autoRef.current = false;
    const ready = orders.filter((o) => o.status === "ready");
    const attention = orders.length - ready.length;
    if (attention === 0) {
      // 전부 확실 → 자동 복사 + 정정 학습 (마지막 복사까지 원샷).
      // 비동기 처리 후라 클립보드 쓰기가 막힐 수 있어, 메시지를 보관해 토스트 탭으로 재복사 가능.
      const message = buildBatchAllMessage(orders, autoTabRef.current);
      navigator.clipboard.writeText(message).catch(() => {});
      orders.forEach((o) => learnOrderCorrections(o.orderLines));
      setAutoResult({ total: orders.length, ready: ready.length, attention: 0, copied: true, message });
    } else {
      setAutoResult({ total: orders.length, ready: ready.length, attention, copied: false, message: "" });
    }
  }, [orders, processing]);

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

  const clear = useCallback(() => { setOrders([]); setAutoResult(null); autoRef.current = false; }, []);

  return { orders, processing, start, startAuto, autoResult, clearAutoResult, selectCandidate, setQuantity, setClient, removeOrder, clear };
}
