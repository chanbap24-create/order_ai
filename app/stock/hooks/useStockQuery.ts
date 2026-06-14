import { useCallback, useState } from "react";

export type StockItem = {
  item_no: string;
  item_name: string;
  supply_price: number | null;
  available_stock: number | null;
  total_stock: number | null;
  pending_shipment: number | null;
  incoming_stock: number | null;
  bonded_warehouse: number | null;
  sales_30days: number | null;
  avg_sales_90d: number | null;
  incoming: Array<{ arrival_date: string; total_btls: number }>;
};

export type StockTab = "CDV" | "DL";

/** 자연어 재고 조회 상태 + 실행 */
export function useStockQuery() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<StockTab>("CDV");
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setItems(null);
    try {
      const res = await fetch("/api/stock/query", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, tab }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "조회 실패");
      setItems(j.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류");
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  return { query, setQuery, tab, setTab, items, loading, error, run };
}
