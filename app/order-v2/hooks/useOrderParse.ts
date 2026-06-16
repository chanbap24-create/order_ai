import { useState } from "react";
import { parseOrder } from "../lib/api";
import type { Client, OrderLine, OrderTab, ParseUsage } from "../types";

/**
 * 발주 텍스트 파싱 상태 + 실행 함수.
 * 파싱 성공 시 orderLines/usage/historySet을 동시에 갱신.
 */
export function useOrderParse() {
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<ParseUsage | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [historySet, setHistorySet] = useState<Set<string>>(new Set());

  async function run(params: {
    tab: OrderTab;
    orderText: string;
    selectedClient: Client | null;
    clientQuery: string;
    onStart?: () => void;
  }): Promise<boolean> {
    if (!params.orderText.trim()) return false;

    setLoading(true);
    setError("");
    setOrderLines([]);
    setUsage(null);
    setModel(null);
    params.onStart?.();

    try {
      const result = await parseOrder({
        clientCode: params.selectedClient?.client_code || "",
        clientName:
          params.selectedClient?.client_name || params.clientQuery || "",
        orderText: params.orderText,
        tab: params.tab,
      });
      setOrderLines(result.orderLines);
      setUsage(result.usage);
      setModel(result.model);
      setHistorySet(
        new Set(result.historyItemNos.map((n) => n.trim().toUpperCase())),
      );
      return true;
    } catch (err: any) {
      setError(err?.message || "네트워크 오류");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOrderLines([]);
    setError("");
    setUsage(null);
    setModel(null);
    setHistorySet(new Set());
  }

  return {
    orderLines,
    setOrderLines,
    loading,
    error,
    usage,
    model,
    historySet,
    run,
    reset,
  };
}
