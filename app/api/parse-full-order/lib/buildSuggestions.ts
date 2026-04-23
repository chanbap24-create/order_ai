import { logger } from "@/app/lib/logger";
import { searchNewItem } from "@/app/lib/newItemResolver";
import { dedupeVintageCandidates, dedupeSuggestions } from "./vintageDedupe";
import { redetermineResolved } from "./autoResolve";

// 동적 require (기존 route와 동일한 패턴)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadConfig(): { config: any; decideSuggestionComposition: any } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/app/lib/itemMatchConfig');
  return { config: mod.ITEM_MATCH_CONFIG, decideSuggestionComposition: mod.decideSuggestionComposition };
}

/**
 * 단일 resolved 품목 x → 중복 제거 + 신규품목 검색 + suggestions 최종 + resolved 재판단.
 * route.ts의 거대한 map 콜백을 여기로 추출.
 */
export async function buildSuggestionsForItem(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  x: any;
  clientItemSet: Set<string>;
  pageType: string;
  clientCode: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  let { x } = params;
  const { clientItemSet, pageType, clientCode } = params;

  // resolved=true인데 item_no 없으면 false
  if (x?.resolved && !x?.item_no) {
    logger.warn(`[CRITICAL] resolved=true인데 item_no 없음 → resolved=false로 강제 변경`, { name: x.name });
    x = { ...x, resolved: false };
  }

  // 이미 resolved된 경우: suggestions만 추가
  if (x?.resolved) {
    const candidates = Array.isArray(x?.candidates) ? x.candidates : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suggestions = candidates.slice(0, 10).map((c: any) => ({
      ...c,
      score: c.score ?? 0,
      supply_price: c.supply_price,
    }));
    return {
      ...x,
      suggestions,
      candidates: suggestions,
    };
  }

  const { config, decideSuggestionComposition } = loadConfig();

  const candidates = Array.isArray(x?.candidates) ? x.candidates : [];
  const dedupedCandidates = dedupeVintageCandidates(candidates, clientItemSet);

  const sortedCandidates = dedupedCandidates
    .slice()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => {
      const scoreDiff = (b?.score ?? 0) - (a?.score ?? 0);
      if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;
      return String(a?.item_no ?? '').localeCompare(String(b?.item_no ?? ''));
    });

  // 기존 입고 품목에 점수 5% 부스트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boostedCandidates = sortedCandidates.map((c: any) => {
    const isInClientHistory = clientItemSet.has(String(c.item_no));
    const boostedScore = isInClientHistory ? (c.score ?? 0) * 1.05 : (c.score ?? 0);
    logger.debug(`[점수부스트]`, { itemNo: c.item_no, original: (c.score ?? 0), boosted: boostedScore, isExisting: isInClientHistory });
    return {
      ...c,
      score: boostedScore,
      original_score: c.score ?? 0,
      is_new_item: c.is_new_item ?? !isInClientHistory,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  boostedCandidates.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let suggestions: any[] = boostedCandidates.slice(0, config.suggestions.total);

  // Wine 페이지: 신규 품목 검색
  if (pageType === "wine") {
    const bestScore = boostedCandidates.length > 0 ? boostedCandidates[0]?.original_score ?? 0 : 0;
    const inputName = x.name || '';

    if (bestScore < config.newItemSearch.threshold && inputName) {
      logger.debug(`[신규품목] 검색 시도`, { inputName, bestScore });
      const newItemCandidates = await searchNewItem(clientCode, inputName, bestScore, config.newItemSearch.threshold);

      if (newItemCandidates && newItemCandidates.length > 0) {
        logger.debug(`[신규품목] English 시트 결과`, { count: newItemCandidates.length });

        const composition = decideSuggestionComposition(boostedCandidates, newItemCandidates);
        logger.debug(`[후보조합]`, { type: composition.type, existing: composition.existing, newItems: composition.newItems, reason: composition.reason });

        const newItemBestScore = newItemCandidates[0]?.score ?? 0;
        const existingBestScore = boostedCandidates[0]?.original_score ?? 0;
        const shouldIncludeNewItems = newItemBestScore >= existingBestScore * 0.7;

        if (!shouldIncludeNewItems) {
          logger.debug(`[후보조합] 신규품목 점수 낮음 → 기존품목만`, { newBest: newItemBestScore, existingBest: existingBestScore });
          suggestions = boostedCandidates.slice(0, config.suggestions.total);
        } else {
          logger.debug(`[후보조합] 신규품목 포함`, { newBest: newItemBestScore, existingBest: existingBestScore });

          const existingSuggestions = boostedCandidates.slice(0, composition.existing);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newItemSuggestions = newItemCandidates.slice(0, composition.newItems).map((c: any) => {
            const isInClientHistory = clientItemSet.has(String(c.itemNo));
            return {
              item_no: c.itemNo,
              item_name: `${c.koreanName} / ${c.englishName}${c.vintage ? ` (${c.vintage})` : ''}`,
              score: c.score,
              source: 'master_sheet',
              is_new_item: !isInClientHistory,
              supply_price: c.supplyPrice,
              _debug: c._debug,
            };
          });

          const deduped = dedupeSuggestions([...existingSuggestions, ...newItemSuggestions]);

          suggestions = deduped
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => {
              const aIsExisting = a.is_new_item === false;
              const bIsExisting = b.is_new_item === false;
              if (aIsExisting && !bIsExisting) return -1;
              if (!aIsExisting && bIsExisting) return 1;
              return (b.score ?? 0) - (a.score ?? 0);
            })
            .slice(0, config.suggestions.total);

          logger.debug(`[최종정렬] 기존품목 우선 → 점수순`, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: suggestions.map((s: any) => ({ no: s.item_no, score: s.score, isNew: s.is_new_item || false })),
          });

          if (suggestions.length > 0) {
            const first = suggestions[0];
            logger.debug(`[정렬검증] 1번 항목`, { item_no: first.item_no, is_new_item: first.is_new_item });
          }

          x.has_new_items = composition.newItems > 0;
          x.new_item_info = composition.newItems > 0 ? {
            message: '신규 품목이 포함되어 있습니다.',
            source: 'order-ai.xlsx (English)',
          } : undefined;
        }
      } else {
        logger.debug(`[신규품목] English 시트 결과 없음`, { showExisting: config.suggestions.total });
      }
    }
  }

  // resolved 재판단
  const { resolved, itemOverride } = redetermineResolved(x, suggestions, config);
  if (!x?.resolved && (!x || !x.item_no)) x = { ...x, resolved };
  else x = { ...x, resolved };

  logger.debug(`[ITEM DEBUG] Before resultItem`, {
    name: x.name, resolved, x_item_no: x.item_no, suggestions_length: suggestions.length,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultItem: any = {
    ...x,
    resolved,
    suggestions,
    candidates: suggestions,
  };

  if (resolved && itemOverride && suggestions.length > 0 && suggestions[0].item_no) {
    logger.debug(`[ITEM DEBUG] Updating item_no`, { item_no: suggestions[0].item_no });
    resultItem.item_no = suggestions[0].item_no;
    resultItem.item_name = suggestions[0].item_name;
    resultItem.score = suggestions[0].score;
  }

  logger.debug(`[ITEM DEBUG] After resultItem`, { name: resultItem.name, resolved: resultItem.resolved, item_no: resultItem.item_no });
  return resultItem;
}
