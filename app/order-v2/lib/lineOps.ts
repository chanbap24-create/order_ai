import type { Candidate, OrderLine, SearchResult } from "../types";

/** 특정 라인의 selectedIdx 교체 */
export function setSelected(
  lines: OrderLine[],
  lineIdx: number,
  candIdx: number,
): OrderLine[] {
  return lines.map((ol, i) => (i === lineIdx ? { ...ol, selectedIdx: candIdx } : ol));
}

/** 수동 검색 결과를 새 후보로 prepend하고 selectedIdx=0으로 맞춘다 */
export function replaceWithSearchResult(
  lines: OrderLine[],
  lineIdx: number,
  wine: SearchResult,
): OrderLine[] {
  return lines.map((ol, i) => {
    if (i !== lineIdx) return ol;
    const newCand: Candidate = {
      item_no: wine.item_no,
      item_name: wine.item_name,
      confidence: 1,
      supply_price: wine.supply_price || 0,
      available_stock: wine.available_stock || 0,
      reasoning: "수동 검색",
    };
    return {
      ...ol,
      candidates: [newCand, ...ol.candidates],
      selectedIdx: 0,
    };
  });
}

/** 라인 삭제 */
export function removeLineAt(lines: OrderLine[], idx: number): OrderLine[] {
  return lines.filter((_, i) => i !== idx);
}

/** 수량 변경 (1 미만은 무시) */
export function setQuantity(lines: OrderLine[], idx: number, qty: number): OrderLine[] {
  if (qty < 1) return lines;
  return lines.map((ol, i) => (i === idx ? { ...ol, quantity: qty } : ol));
}

/** 선택된 후보의 공급가 변경 */
export function setSelectedSupplyPrice(
  lines: OrderLine[],
  lineIdx: number,
  price: number,
): OrderLine[] {
  return lines.map((ol, i) => {
    if (i !== lineIdx) return ol;
    const candIdx = ol.selectedIdx;
    if (candIdx < 0) return ol;
    const newCands = [...ol.candidates];
    newCands[candIdx] = { ...newCands[candIdx], supply_price: price };
    return { ...ol, candidates: newCands };
  });
}
