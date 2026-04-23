import { useCallback, useState } from "react";

/**
 * 이탈 위험 카드 expand 시 최근 주문 5건 로드.
 * expandedClient/cache/loading 상태를 한곳에서 관리.
 */
export function useRecentOrders() {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<Record<string, any[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);

  const handleCardClick = useCallback(
    async (clientCode: string) => {
      if (expandedClient === clientCode) {
        setExpandedClient(null);
        return;
      }
      setExpandedClient(clientCode);
      if (recentOrders[clientCode]) return;

      setLoadingOrders(clientCode);
      try {
        const res = await fetch(
          `/api/sales/clients/stats?code=${encodeURIComponent(clientCode)}`,
        );
        const data = await res.json();
        if (data.recent_shipments) {
          setRecentOrders((prev) => ({
            ...prev,
            [clientCode]: data.recent_shipments.slice(0, 5),
          }));
        }
      } catch {
        // ignore
      } finally {
        setLoadingOrders(null);
      }
    },
    [expandedClient, recentOrders],
  );

  return { expandedClient, recentOrders, loadingOrders, handleCardClick };
}
