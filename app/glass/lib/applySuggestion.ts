import { getGlassUnit, POSSIBLE_UNITS } from "./glassUnit";

type Suggestion = {
  item_no?: string;
  code?: string;
  item_name?: string;
  score?: number;
  is_new_item?: boolean;
};

type Item = {
  name?: string;
  raw?: string;
  qty?: number;
  item_no?: string;
  item_name?: string;
  resolved?: boolean;
  score?: number;
};

type ParseResult = {
  status?: string;
  items?: Item[];
  staff_message?: string;
  [key: string]: any;
};

/**
 * 선택한 후보(s)를 prev 결과에 적용한 새 결과를 반환한다.
 * - items[itemIndex] 확정 처리
 * - 직원 메시지 라인을 올바른 단위·코드·(신규 시 가격 포함)으로 치환
 * - 모두 확정되면 status="resolved", 아니면 "needs_review_items"
 */
export function applySuggestionToResult(
  prev: ParseResult,
  itemIndex: number,
  s: Suggestion,
  price?: string,
): ParseResult {
  if (!prev) return prev;

  const next: ParseResult = { ...prev };
  const items = Array.isArray(next.items) ? [...next.items] : [];
  const target = items[itemIndex];
  if (!target) return prev;

  const qty = target.qty;
  const unit = getGlassUnit(s.item_name || "");

  // 1) items 확정 처리
  items[itemIndex] = {
    ...target,
    resolved: true,
    item_no: s.item_no,
    item_name: s.item_name,
    score: typeof s.score === "number" ? s.score : target.score,
  };
  next.items = items;

  // 2) 직원 메시지 라인 치환
  const staff = String(next.staff_message ?? "");
  const koreanName = s.item_name?.split(" / ")[0] || s.item_name;
  const codeDisplay = s.code || s.item_no;
  const newLine = price
    ? `- ${codeDisplay} / ${koreanName} / ${qty}${unit} / ${parseInt(price, 10).toLocaleString()}원`
    : `- ${codeDisplay} / ${koreanName} / ${qty}${unit}`;

  let oldLineUnresolved = "";
  let oldLineResolved = "";

  for (const u of POSSIBLE_UNITS) {
    const testUnresolved = `- 확인필요 / "${target.name}" / ${qty}${u}`;
    const testResolved = target?.item_no
      ? `- ${target.item_no} / ${target.item_name} / ${qty}${u}`
      : "";

    if (staff.includes(testUnresolved)) {
      oldLineUnresolved = testUnresolved;
      break;
    }
    if (testResolved && staff.includes(testResolved)) {
      oldLineResolved = testResolved;
      break;
    }
  }

  if (!oldLineUnresolved && !oldLineResolved) {
    oldLineUnresolved = `- 확인필요 / "${target.name}" / ${qty}병`;
    oldLineResolved = target?.item_no
      ? `- ${target.item_no} / ${target.item_name} / ${qty}병`
      : "";
  }

  if (staff.includes(oldLineUnresolved)) {
    next.staff_message = staff.replace(oldLineUnresolved, newLine);
  } else if (oldLineResolved && staff.includes(oldLineResolved)) {
    next.staff_message = staff.replace(oldLineResolved, newLine);
  } else {
    next.staff_message = staff
      .split("\n")
      .map((line) => {
        const hasQtyWithAnyUnit = POSSIBLE_UNITS.some((u) => line.includes(`${qty}${u}`));
        if (!hasQtyWithAnyUnit) return line;

        const hitUnresolved =
          line.includes("확인필요") && line.includes(String(target.name ?? ""));
        const hitResolved = target?.item_no && line.includes(String(target.item_no));

        if (hitUnresolved || hitResolved) return newLine;
        return line;
      })
      .join("\n");
  }

  // 3) status 업데이트
  const hasUnresolved = items.some((x) => !x?.resolved);
  next.status = hasUnresolved ? "needs_review_items" : "resolved";

  return next;
}
