import { useState } from "react";

/**
 * 품목별 편집(수량/가격/할인율 입력 중 텍스트 + 확정된 할인율 + 펼침 상태) 묶음.
 * 값 타입은 모두 key=lineIdx.
 */
export function useItemEditor() {
  const [editingQty, setEditingQty] = useState<Record<number, string>>({});
  const [editingPrice, setEditingPrice] = useState<Record<number, string>>({});
  const [discountRates, setDiscountRates] = useState<Record<number, number>>({});
  const [customDiscountInput, setCustomDiscountInput] = useState<
    Record<number, string>
  >({});
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  const setDiscount = (idx: number, rate: number) => {
    setDiscountRates((prev) => ({ ...prev, [idx]: rate }));
  };

  const toggleExpand = (idx: number) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const reset = () => {
    setEditingQty({});
    setEditingPrice({});
    setDiscountRates({});
    setCustomDiscountInput({});
    setExpandedLines(new Set());
  };

  return {
    editingQty,
    setEditingQty,
    editingPrice,
    setEditingPrice,
    discountRates,
    setDiscountRates,
    setDiscount,
    customDiscountInput,
    setCustomDiscountInput,
    expandedLines,
    toggleExpand,
    reset,
  };
}
