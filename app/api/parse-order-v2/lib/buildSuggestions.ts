import { searchNewItem } from "@/app/lib/newItemResolver";

/**
 * 단일 resolvedItem x에 suggestions를 붙이는 파이프.
 * resolved면 그대로 반환. unresolved면 기존 candidates + 신규 품목 검색 결합.
 */
export async function buildSuggestionsForItem(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  x: any;
  pageType: string;
  clientCode: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  const { x, pageType, clientCode } = params;

  if (x?.resolved) return x;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ITEM_MATCH_CONFIG, decideSuggestionComposition } = require('@/app/lib/itemMatchConfig');
  const config = ITEM_MATCH_CONFIG;

  const candidates = Array.isArray(x?.candidates) ? x.candidates : [];
  const sortedCandidates = candidates
    .slice()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));

  let suggestions = sortedCandidates.slice(0, config.suggestions.total);

  // Wine 페이지: 점수 낮으면 신규 품목 검색
  if (pageType === "wine") {
    const bestScore = sortedCandidates.length > 0 ? sortedCandidates[0]?.score ?? 0 : 0;
    const inputName = x.name || '';

    if (bestScore < config.newItemSearch.threshold && inputName) {
      console.log(`[신규품목] 검색 시도: "${inputName}", bestScore=${bestScore.toFixed(3)}`);

      const newItemCandidates = await searchNewItem(
        clientCode, inputName, bestScore, config.newItemSearch.threshold,
      );

      if (newItemCandidates && newItemCandidates.length > 0) {
        console.log(`[신규품목] English 시트에서 ${newItemCandidates.length}개 발견`);

        const composition = decideSuggestionComposition(sortedCandidates, newItemCandidates);
        console.log(`[후보조합] ${composition.type}: 기존 ${composition.existing}개 + 신규 ${composition.newItems}개 (${composition.reason})`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newItemSuggestions = newItemCandidates.slice(0, composition.newItems).map((c: any) => ({
          item_no: c.itemNo,
          item_name: `${c.koreanName} / ${c.englishName}${c.vintage ? ` (${c.vintage})` : ''}`,
          score: c.score,
          source: 'master_sheet',
          is_new_item: true,
          _debug: c._debug,
        }));

        suggestions = [
          ...sortedCandidates.slice(0, composition.existing),
          ...newItemSuggestions,
        ].slice(0, config.suggestions.total);

        console.log(`[신규품목] 최종 후보:`, suggestions.map((s: { item_no: string; score?: number; is_new_item?: boolean }) => ({
          no: s.item_no,
          score: s.score?.toFixed(3),
          isNew: s.is_new_item || false,
        })));

        return {
          ...x,
          suggestions,
          has_new_items: composition.newItems > 0,
          new_item_info: composition.newItems > 0 ? {
            message: '신규 품목이 포함되어 있습니다.',
            source: 'order-ai.xlsx (English)',
          } : undefined,
        };
      }
      console.log(`[신규품목] English 시트 결과 없음 - 기존품목 ${config.suggestions.total}개 표시`);
    }
  }

  return { ...x, suggestions };
}
