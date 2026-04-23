import { useCallback, useEffect, useRef, useState } from "react";
import type { InventoryItem, QuoteItem } from "../types";
import { calcDiscountedPrice } from "../lib/priceCalc";

export type WineProfile = {
  grape_varieties: string;
  description_kr: string;
};

type Params = {
  /** 세션 manager. 'manager' 값이 바뀌면 견적 자동 로드 */
  quoteManager: string;
  /** API 쿼리용 manager (빈 문자열이면 전역) */
  getManagerParam: () => string;
  /** 항목 추가 성공 직후 호출 (caller가 패널 토글 등 수행) */
  onAddSucceeded?: () => void;
};

/**
 * 견적 CRUD + 인라인 편집 + 모바일 바텀시트 상태 전체를 포괄.
 * Manager 확정되면 견적 자동 로드.
 */
export function useQuoteItems(p: Params) {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [clientName, setClientName] = useState("");
  const [wineProfiles, setWineProfiles] = useState<Record<string, WineProfile>>({});

  // 바텀시트
  const [bottomSheetItem, setBottomSheetItem] = useState<QuoteItem | null>(null);
  const [sheetValues, setSheetValues] = useState<Record<string, any>>({});

  // "방금 추가됨" 시각 피드백
  const [addedItemNo, setAddedItemNo] = useState<string | null>(null);
  const addedFeedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getManagerParam } = p;

  const fetchQuoteItems = useCallback(async () => {
    try {
      const mgr = getManagerParam();
      const res = await fetch(
        `/api/quote${mgr ? `?manager=${encodeURIComponent(mgr)}` : ""}`,
      );
      const data = await res.json();
      if (!data.success) return;

      const items: QuoteItem[] = data.items || [];
      setQuoteItems(items);

      const codes = items.map((i) => i.item_code).filter(Boolean);
      if (codes.length === 0) return;
      try {
        const wpRes = await fetch(
          `/api/wine-profiles?item_codes=${encodeURIComponent(JSON.stringify(codes))}`,
        );
        const wpData = await wpRes.json();
        if (wpData.success && wpData.profiles) {
          const map: Record<string, WineProfile> = {};
          for (const q of wpData.profiles) {
            map[q.item_code] = {
              grape_varieties: q.grape_varieties || "",
              description_kr: q.description_kr || "",
            };
          }
          setWineProfiles(map);
        }
      } catch {
        // ignore
      }
    } catch (e) {
      console.error("Failed to fetch quote items:", e);
    } finally {
      setQuoteLoading(false);
    }
  }, [getManagerParam]);

  // quoteManager 확정 시 자동 로드
  useEffect(() => {
    if (!p.quoteManager) return;
    void fetchQuoteItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.quoteManager]);

  const updateQuoteItem = useCallback(
    async (id: number, fields: Record<string, any>) => {
      try {
        const res = await fetch("/api/quote", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...fields }),
        });
        const data = await res.json();
        if (data.success && data.item) {
          setQuoteItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
        }
      } catch (e) {
        console.error("Failed to update:", e);
      }
    },
    [],
  );

  const addToQuote = useCallback(
    async (inv: InventoryItem) => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_code: inv.item_no,
            product_name: inv.item_name,
            supply_price: inv.supply_price,
            min_price: inv.min_price || 0,
            retail_price: inv.retail_price || 0,
            country: inv.country || "",
            vintage: inv.vintage || "",
            quantity: 1,
            discount_rate: 0,
            manager: getManagerParam(),
          }),
        });
        const data = await res.json();
        if (!data.success) return;

        await fetchQuoteItems();
        p.onAddSucceeded?.();

        setAddedItemNo(inv.item_no);
        if (addedFeedbackRef.current) clearTimeout(addedFeedbackRef.current);
        addedFeedbackRef.current = setTimeout(() => setAddedItemNo(null), 1200);
      } catch (e) {
        console.error("Failed to add item:", e);
      }
    },
    [fetchQuoteItems, getManagerParam, p],
  );

  const deleteQuoteItem = useCallback(async (id: number) => {
    try {
      await fetch(`/api/quote?id=${id}`, { method: "DELETE" });
      setQuoteItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  }, []);

  const moveItem = useCallback(
    async (idx: number, direction: "up" | "down") => {
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      setQuoteItems((prev) => {
        if (newIdx < 0 || newIdx >= prev.length) return prev;
        const arr = [...prev];
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        const reordered = arr.map((item, i) => ({ ...item, sort_order: i }));
        // 서버에 persist (fire-and-forget)
        void fetch("/api/quote", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reorder",
            items: reordered.map((item) => ({ id: item.id, sort_order: item.sort_order })),
          }),
        }).catch((e) => console.error("Failed to reorder:", e));
        return reordered;
      });
    },
    [],
  );

  const clearAllQuote = useCallback(async () => {
    if (!confirm("견적서의 모든 항목을 삭제하시겠습니까?")) return;
    // 순차 삭제 — race condition 방지
    const ids = quoteItems.map((i) => i.id);
    for (const id of ids) {
      await fetch(`/api/quote?id=${id}`, { method: "DELETE" });
    }
    setQuoteItems([]);
  }, [quoteItems]);

  // 모바일 바텀시트
  const openBottomSheet = useCallback((item: QuoteItem) => {
    setBottomSheetItem(item);
    setSheetValues({
      quantity: item.quantity,
      discount_rate: Math.round(item.discount_rate * 100),
      discounted_price: String(
        calcDiscountedPrice(item.supply_price, item.discount_rate, item.discounted_price),
      ),
      note: item.note || "",
      tasting_note: item.tasting_note || "",
    });
  }, []);

  const closeBottomSheet = useCallback(() => setBottomSheetItem(null), []);

  const saveBottomSheet = useCallback(async () => {
    if (!bottomSheetItem) return;
    const dp = parseInt(sheetValues.discounted_price) || 0;
    const rate =
      bottomSheetItem.supply_price > 0
        ? (bottomSheetItem.supply_price - dp) / bottomSheetItem.supply_price
        : 0;
    await updateQuoteItem(bottomSheetItem.id, {
      quantity: Math.max(0, parseInt(sheetValues.quantity) || 0),
      discount_rate: Math.round(rate * 10000) / 10000,
      discounted_price: dp,
      note: sheetValues.note || "",
      tasting_note: sheetValues.tasting_note || "",
    });
    setBottomSheetItem(null);
  }, [bottomSheetItem, sheetValues, updateQuoteItem]);

  return {
    // data
    quoteItems,
    setQuoteItems,
    quoteLoading,
    clientName,
    setClientName,
    wineProfiles,
    addedItemNo,
    // CRUD
    fetchQuoteItems,
    addToQuote,
    deleteQuoteItem,
    updateQuoteItem,
    moveItem,
    clearAllQuote,
    // bottom sheet
    bottomSheetItem,
    sheetValues,
    setSheetValues,
    openBottomSheet,
    closeBottomSheet,
    saveBottomSheet,
  };
}
