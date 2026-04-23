import { useEffect } from "react";
import { AUTO_COPY_DELAY_MS } from "../constants";

type Args = {
  data: any;
  setShowItemsPanel: (v: boolean) => void;
  onAutoCopy: () => void | Promise<void>;
  setNewItemPrices: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
};

/**
 * data 변화에 따른 wine 페이지 자동 부수효과:
 * 1. status에 따른 품목 패널 오픈/클로즈
 * 2. resolved → 300ms 후 자동 복사
 * 3. 신규/미입고 품목 공급가 자동 채움
 */
export function useOrderAutoEffects({
  data,
  setShowItemsPanel,
  onAutoCopy,
  setNewItemPrices,
}: Args) {
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
      }, AUTO_COPY_DELAY_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status]);

  useEffect(() => {
    const items = data?.items;
    if (!items) return;
    const newPrices: Record<string, string> = {};
    items.forEach((item: any, idx: number) => {
      if (!Array.isArray(item.suggestions)) return;
      item.suggestions.forEach((s: any) => {
        const itemKey = `${idx}-${s.item_no}`;
        const needsPrice = !!s.is_new_item;
        if (!needsPrice) return;
        if (s.price) newPrices[itemKey] = String(s.price);
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
