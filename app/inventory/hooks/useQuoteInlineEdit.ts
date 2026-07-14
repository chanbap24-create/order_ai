import { useCallback, useState } from "react";
import type { QuoteItem } from "../types";
import { roundTo100 } from "@/app/lib/priceUtils";

export type EditCell = { id: number; key: string } | null;

type Params = {
  quoteItems: QuoteItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateQuoteItem: (id: number, fields: Record<string, any>) => Promise<void>;
};

/**
 * 견적 테이블 인라인 편집 상태/로직.
 * - discount_rate ↔ discounted_price 상호 계산
 * - retail_discounted_price도 같은 할인율 역산
 * - 숫자/문자 컬럼 공용 처리
 */
export function useQuoteInlineEdit({ quoteItems, updateQuoteItem }: Params) {
  const [editCell, setEditCell] = useState<EditCell>(null);
  const [editValue, setEditValue] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startEdit = useCallback((id: number, key: string, currentValue: any) => {
    setEditCell({ id, key });
    if (key === "discount_rate") {
      setEditValue(String(Math.round((currentValue || 0) * 100)));
    } else if (key === "discounted_price" || key === "retail_discounted_price") {
      setEditValue(String(Math.round(Number(currentValue) || 0)));
    } else {
      setEditValue(String(currentValue ?? ""));
    }
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editCell) return;
    const { id, key } = editCell;
    const raw = editValue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalize = async (fields: Record<string, any>) => {
      await updateQuoteItem(id, fields);
      setEditCell(null);
      setEditValue("");
    };

    if (key === "quantity") {
      await finalize({ quantity: Math.max(0, parseInt(raw) || 0) });
      return;
    }
    if (key === "discount_rate") {
      const rateVal = Math.min(100, Math.max(0, parseInt(raw) || 0)) / 100;
      const item = quoteItems.find((i) => i.id === id);
      const dp = item ? roundTo100(item.supply_price * (1 - rateVal)) : 0;
      await finalize({ discount_rate: rateVal, discounted_price: dp });
      return;
    }
    if (key === "supply_price") {
      await finalize({ supply_price: Math.max(0, parseInt(raw) || 0) });
      return;
    }
    if (key === "discounted_price") {
      const item = quoteItems.find((i) => i.id === id);
      if (item && item.supply_price > 0) {
        const newPrice = Math.max(0, parseInt(raw) || 0);
        const newRate = (item.supply_price - newPrice) / item.supply_price;
        await finalize({
          discount_rate: Math.round(newRate * 10000) / 10000,
          discounted_price: newPrice,
        });
        return;
      }
    }
    if (key === "retail_discounted_price") {
      const item = quoteItems.find((i) => i.id === id);
      if (item && (item.retail_price || 0) > 0) {
        const newPrice = Math.max(0, parseInt(raw) || 0);
        const newRate = ((item.retail_price || 0) - newPrice) / (item.retail_price || 1);
        await finalize({
          discount_rate: Math.round(newRate * 10000) / 10000,
          discounted_price: newPrice,
        });
        return;
      }
    }
    // 일반 문자열 컬럼 (note 등)
    await finalize({ [key]: raw });
  }, [editCell, editValue, quoteItems, updateQuoteItem]);

  return {
    editCell,
    editValue,
    setEditCell,
    setEditValue,
    startEdit,
    commitEdit,
  };
}
