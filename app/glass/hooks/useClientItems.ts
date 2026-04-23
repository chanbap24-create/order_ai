import { useState } from "react";
import { fetchClientItems } from "../lib/api";

/**
 * "거래처 품목 보기" 상태/로드 로직.
 * - 토글, 로딩 플래그, 품목 배열을 함께 관리.
 */
export function useClientItems() {
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async (clientCode: string | undefined | null) => {
    if (!clientCode) return;
    setLoading(true);
    try {
      const rows = await fetchClientItems(clientCode);
      setItems(rows);
      setShow(true);
    } catch (error) {
      console.error("Failed to load client items:", error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setItems([]);
    setShow(false);
  };

  return { items, show, setShow, loading, load, reset };
}
