import { SUGGESTION_LIMITS } from "../constants";

/**
 * 품목 후보 목록을 정렬하고 표시 개수를 제한한다.
 * - 기존 품목(거래처 입고이력 O, 신규 아님)을 우선
 * - 그 외에는 score 내림차순
 * - 확정 품목은 접힌 상태에서 2개, 미확정은 5개, 더보기 시 20개
 */
export function getSuggestions(
  item: { suggestions?: unknown; candidates?: unknown; resolved?: boolean } | null | undefined,
  showMore: boolean,
): any[] {
  const raw =
    Array.isArray((item as any)?.suggestions) && (item as any).suggestions.length > 0
      ? (item as any).suggestions
      : Array.isArray((item as any)?.candidates)
        ? (item as any).candidates
        : [];

  const sorted = [...raw].sort((a: any, b: any) => {
    const aIsExisting = !a.is_new_item && a.in_client_history;
    const bIsExisting = !b.is_new_item && b.in_client_history;
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
