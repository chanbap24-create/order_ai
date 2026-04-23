import { WINE_UNIT } from "../constants";
import type { ParseItem, ParseResult, Suggestion } from "../types";

/**
 * 와인 선택 후보(s)를 prev 결과에 반영한 새 결과 반환.
 * - items[itemIndex] 확정 처리 (unit_price_hint 업데이트)
 * - 직원 메시지 라인 치환 (단위는 항상 "병", 신규일 경우 가격 포함)
 * - 모두 확정되면 status="resolved"
 */
export function applySuggestionToResult(
  prev: ParseResult | null,
  itemIndex: number,
  s: Suggestion,
  supplyPrice?: string,
): ParseResult | null {
  if (!prev) return prev;

  const next: ParseResult = { ...prev };
  const items: ParseItem[] = Array.isArray(next.items) ? [...next.items] : [];
  const target = items[itemIndex];
  if (!target) return prev;

  const qty = target.qty;
  const isNewItem = !!s.is_new_item;

  // 1) items 확정 처리
  items[itemIndex] = {
    ...target,
    resolved: true,
    item_no: s.item_no,
    item_name: s.item_name,
    score: typeof s.score === "number" ? s.score : target.score,
    unit_price_hint: supplyPrice
      ? parseInt(supplyPrice, 10)
      : target.unit_price_hint,
  };
  next.items = items;

  // 2) 직원 메시지 라인 치환
  const staff = String(next.staff_message ?? "");
  const koreanName = s.item_name?.split(" / ")[0] || s.item_name;

  const targetDisplayName =
    target.name !== undefined && target.name !== null && String(target.name).trim() !== ""
      ? String(target.name).trim()
      : target.raw || "이름없음";

  const oldLineUnresolved = `- 확인필요 / "${targetDisplayName}" / ${qty}${WINE_UNIT}`;
  const targetKoreanName = target?.item_name?.split(" / ")[0] || target?.item_name || "";
  const oldLineResolved = target?.item_no
    ? `- ${target.item_no} / ${targetKoreanName} / ${qty}${WINE_UNIT}`
    : "";

  const newLine =
    isNewItem && supplyPrice
      ? `- ${s.item_no} / ${koreanName} / ${qty}${WINE_UNIT} / ${parseInt(supplyPrice, 10).toLocaleString()}원`
      : `- ${s.item_no} / ${koreanName} / ${qty}${WINE_UNIT}`;

  if (staff.includes(oldLineUnresolved)) {
    next.staff_message = staff.replace(oldLineUnresolved, newLine);
  } else if (oldLineResolved && staff.includes(oldLineResolved)) {
    next.staff_message = staff.replace(oldLineResolved, newLine);
  } else {
    next.staff_message = staff
      .split("\n")
      .map((line) => {
        const hasQty = line.includes(`${qty}${WINE_UNIT}`);
        if (!hasQty) return line;
        const hitUnresolved =
          line.includes("확인필요") && line.includes(targetDisplayName);
        const hitResolved =
          target?.item_no && line.includes(String(target.item_no));
        if (hitUnresolved || hitResolved) return newLine;
        return line;
      })
      .join("\n");
  }

  // 3) status
  const hasUnresolved = items.some((x) => !x?.resolved);
  next.status = hasUnresolved ? "needs_review_items" : "resolved";

  return next;
}
