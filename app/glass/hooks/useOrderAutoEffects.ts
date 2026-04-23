import { useEffect } from "react";

type Args = {
  data: any;
  /** 상태별 품목 패널 자동 토글 */
  setShowItemsPanel: (v: boolean) => void;
  /** 전체 확정 시 자동 복사 트리거 */
  onAutoCopy: () => void | Promise<void>;
  /** 신규/미입고 품목 공급가를 입력란에 자동 채우기 */
  setNewItemPrices: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
};

/**
 * 발주 결과(data)가 바뀔 때 트리거되는 자동 부수효과들:
 * 1. status에 따른 품목 결과 패널 자동 오픈/클로즈
 * 2. 전체 확정(resolved) 시 300ms 후 자동 복사
 * 3. 신규/미입고 품목의 공급가를 newItemPrices에 채워 넣기
 */
export function useOrderAutoEffects({
  data,
  setShowItemsPanel,
  onAutoCopy,
  setNewItemPrices,
}: Args) {
  // status → 품목 패널 토글 + 자동 복사
  useEffect(() => {
    const st = data?.status;
    if (!st) return;

    if (st === "needs_review_items") {
      setShowItemsPanel(true);
      return;
    }
    if (st === "needs_review_client") {
      setShowItemsPanel(false);
      return;
    }
    if (st === "resolved") {
      setShowItemsPanel(false);
      setTimeout(() => {
        void onAutoCopy();
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status]);

  // 신규/미입고 품목 공급가 자동 채우기
  useEffect(() => {
    if (!data?.items) return;

    const newPrices: Record<string, string> = {};
    data.items.forEach((item: any, idx: number) => {
      if (!Array.isArray(item.suggestions)) return;
      item.suggestions.forEach((s: any) => {
        const itemKey = `${idx}-${s.code || s.item_no}`;
        const needsPrice = !!s.is_new_item || !s.in_client_history;
        if (!needsPrice) return;
        // Glass 신규품목은 price 필드 우선, 없으면 supply_price 폴백
        if (s.price) {
          newPrices[itemKey] = String(s.price);
        }
        if (s.supply_price && !newPrices[itemKey]) {
          newPrices[itemKey] = String(s.supply_price);
        }
      });
    });

    if (Object.keys(newPrices).length > 0) {
      setNewItemPrices((prev) => ({ ...prev, ...newPrices }));
    }
  }, [data?.items, setNewItemPrices]);
}
