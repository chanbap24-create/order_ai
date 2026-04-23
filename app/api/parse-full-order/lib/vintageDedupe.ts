import { extractVintage, removeVintageFromName } from "../parse/utils";
import { logger } from "@/app/lib/logger";

/**
 * candidates 빈티지 중복 제거:
 *  - 같은 base name 그룹에서 "기존 이력 있는 품목"은 최신 빈티지 1개만 선택
 *  - "신규 품목"은 빈티지 상관없이 전부 포함
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dedupeVintageCandidates(candidates: any[], clientItemSet: Set<string>): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped = new Map<string, any[]>();
  for (const c of candidates) {
    const baseName = removeVintageFromName(c.item_name || '');
    if (!grouped.has(baseName)) grouped.set(baseName, []);
    grouped.get(baseName)?.push(c);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deduped: any[] = [];
  for (const [baseName, group] of grouped.entries()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    const existingItems = group.filter((c) => clientItemSet.has(String(c.item_no)));
    const newItems = group.filter((c) => !clientItemSet.has(String(c.item_no)));

    if (existingItems.length > 0) {
      const withVintage = existingItems.map((c) => ({ ...c, _vintage: extractVintage(c.item_no) }));
      const sorted = withVintage.sort((a, b) => {
        if (a._vintage && b._vintage) return b._vintage - a._vintage;
        return (b.score ?? 0) - (a.score ?? 0);
      });
      logger.debug(`[빈티지] 기존 입고 선택`, { baseName, itemNo: sorted[0].item_no, total: existingItems.length });
      deduped.push(sorted[0]);
    }

    newItems.forEach((c) => {
      logger.debug(`[빈티지] 신규 추가`, { baseName, itemNo: c.item_no });
      deduped.push(c);
    });
  }

  return deduped;
}

/**
 * 기존+신규 합쳐진 suggestions에서 2단계 중복 제거:
 *  1) 같은 item_no면 기존 품목 우선
 *  2) 같은 base name이면 기존+신규 각 그룹에서 최신 빈티지 1개씩 (둘 다 있으면 2건 유지)
 */
export function dedupeSuggestions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allSuggestions: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupByItemNo = new Map<string, any[]>();
  for (const s of allSuggestions) {
    const itemNo = String(s.item_no || '');
    if (!itemNo) continue;
    if (!groupByItemNo.has(itemNo)) groupByItemNo.set(itemNo, []);
    groupByItemNo.get(itemNo)?.push(s);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dedupedByItemNo: any[] = [];
  for (const [itemNo, group] of Array.from(groupByItemNo.entries())) {
    if (group.length === 1) {
      dedupedByItemNo.push(group[0]);
      continue;
    }
    const existingItems = group.filter((s) => s.is_new_item === false);
    const newItems = group.filter((s) => s.is_new_item === true);

    if (existingItems.length > 0) {
      const best = existingItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      logger.debug(`[중복제거] 기존 입고품목 우선`, { itemNo, count: existingItems.length, itemName: best.item_name });
      dedupedByItemNo.push(best);
    } else {
      const best = newItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      dedupedByItemNo.push(best);
    }
  }

  // 2단계: base name 그룹화 (빈티지 중복)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupByName = new Map<string, any[]>();
  for (const s of dedupedByItemNo) {
    const baseNameWithoutVintage = removeVintageFromName(s.item_name || '');
    if (!groupByName.has(baseNameWithoutVintage)) groupByName.set(baseNameWithoutVintage, []);
    groupByName.get(baseNameWithoutVintage)?.push(s);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deduped: any[] = [];
  for (const [baseName, group] of Array.from(groupByName.entries())) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    const withVintage = group.map((s) => ({ ...s, _vintage: extractVintage(s.item_no) }));
    const existingItems = withVintage.filter((s) => s.is_new_item === false);
    const newItems = withVintage.filter((s) => s.is_new_item === true);

    // 기존+신규 둘 다 있으면 각 최신 빈티지 1개씩 유지
    if (existingItems.length > 0 && newItems.length > 0) {
      const existingSorted = existingItems.sort((a, b) => {
        if (a._vintage && b._vintage) return b._vintage - a._vintage;
        return (b.score ?? 0) - (a.score ?? 0);
      });
      const newSorted = newItems.sort((a, b) => {
        if (a._vintage && b._vintage) return b._vintage - a._vintage;
        return (b.score ?? 0) - (a.score ?? 0);
      });
      logger.debug(`[빈티지중복] 기존+신규 모두 표시`, { baseName, existing: existingSorted[0].item_no, newItem: newSorted[0].item_no });
      deduped.push(existingSorted[0]);
      deduped.push(newSorted[0]);
      continue;
    }

    // 한쪽만 있으면 최신 빈티지 1개
    const sorted = withVintage.sort((a, b) => {
      const aIsExisting = a.is_new_item === false;
      const bIsExisting = b.is_new_item === false;
      if (aIsExisting && !bIsExisting) return -1;
      if (!aIsExisting && bIsExisting) return 1;
      if (a._vintage && b._vintage) return b._vintage - a._vintage;
      return (b.score ?? 0) - (a.score ?? 0);
    });
    const selected = sorted[0];
    if (group.length > 1) {
      const isExisting = selected.is_new_item === false;
      logger.debug(`[빈티지중복] 선택`, {
        baseName, itemNo: selected.item_no,
        type: isExisting ? '기존품목' : '신규빈티지',
        vintage: selected._vintage, groupSize: group.length,
      });
    }
    deduped.push(selected);
  }

  return deduped;
}
