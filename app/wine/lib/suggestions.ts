import { SUGGESTION_LIMITS } from "../constants";
import type { ParseItem, Suggestion } from "../types";

/**
 * 와인 후보 정렬 + 슬라이싱.
 * - 기존 품목(is_new_item === false) 우선
 * - 같은 그룹 내 score 내림차순
 * - 확정 품목은 접힘 시 2개, 미확정은 10개, 더보기 시 20개
 */
export function getSuggestions(
  item: ParseItem | null | undefined,
  showMore: boolean,
): Suggestion[] {
  const raw =
    Array.isArray(item?.suggestions) && item!.suggestions!.length > 0
      ? item!.suggestions!
      : Array.isArray(item?.candidates)
        ? item!.candidates!
        : [];

  const sorted = [...raw].sort((a, b) => {
    const aIsExisting = a.is_new_item === false;
    const bIsExisting = b.is_new_item === false;
    if (aIsExisting && !bIsExisting) return -1;
    if (!aIsExisting && bIsExisting) return 1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  if (showMore) return sorted.slice(0, SUGGESTION_LIMITS.expanded);
  const isResolved = item?.resolved === true;
  return isResolved
    ? sorted.slice(0, SUGGESTION_LIMITS.resolvedCollapsed)
    : sorted.slice(0, SUGGESTION_LIMITS.unresolvedCollapsed);
}
