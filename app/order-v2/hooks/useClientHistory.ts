import { useCallback, useState } from "react";
import { fetchClientHistory } from "../lib/api";
import type { HistoryItem, OrderTab } from "../types";

/**
 * 거래처 입고내역 조회 + 접기/펼치기 상태.
 * - toggle 시 미로드라면 자동 fetch
 * - reset은 거래처 변경/탭 전환 시 외부에서 호출
 */
export function useClientHistory(clientCode: string | undefined, tab: OrderTab) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [show, setShow] = useState(false);
  const [showOld, setShowOld] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!clientCode) return;
    setLoading(true);
    try {
      const list = await fetchClientHistory(clientCode, tab);
      setItems(list);
      setLoaded(true);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clientCode, tab]);

  const toggle = () => {
    if (!show && !loaded) void fetchItems();
    setShow((v) => !v);
  };

  const reset = () => {
    setItems([]);
    setLoaded(false);
    setShow(false);
    setShowOld(false);
  };

  return {
    items,
    loading,
    loaded,
    fetchItems,
    show,
    setShow,
    showOld,
    setShowOld,
    toggle,
    reset,
  };
}
