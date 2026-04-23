import { hierarchicalSearch } from "@/app/lib/brandMatcher";
import { expandQueryWithLLM } from "@/app/lib/llmReranker";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { logger } from "@/app/lib/logger";

/**
 * weighted resolve 결과에서 점수 <0.5인 품목에 대해 사후 LLM 확장으로 재검색.
 * 사전 확장된 항목은 중복 방지로 스킵.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runLlmExpandRetry(resolvedItems: any[], clientCode: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandedResults: any[] = [];

  for (const item of resolvedItems) {
    // 이미 사전 확장된 항목은 스킵
    if (item._llmExpanded || item._originalName) {
      expandedResults.push(item);
      continue;
    }
    const topScore = item?.score ?? (item?.candidates?.[0]?.score ?? 0);
    if (topScore < 0.5 && item.name) {
      try {
        const expanded = await expandQueryWithLLM(String(item.name));
        if (expanded && expanded.expandedQueries.length > 0 && expanded.confidence >= 0.5) {
          logger.debug(`[LLM Expand] "${item.name}" → "${expanded.wineName}" (${expanded.expandedQueries.join(", ")})`);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let bestResult: any = null;

          // 1) 확장 키워드로 브랜드 매칭 재시도
          for (const eq of expanded.expandedQueries) {
            try {
              const brandResults = await hierarchicalSearch(eq, 0.4, 0.3, 3);
              if (brandResults.length > 0 && brandResults[0].wines.length > 0) {
                const topBrand = brandResults[0];
                const topWine = topBrand.wines[0];
                if (!bestResult || topWine.score > (bestResult.score ?? 0)) {
                  bestResult = {
                    ...item,
                    resolved: !!(topWine.item_no) && topWine.score >= 0.6,
                    item_no: topWine.item_no,
                    item_name: topWine.wine_kr,
                    score: topWine.score,
                    method: 'llm_expand_brand',
                    supply_price: topWine.price,
                    llm_expanded: expanded.wineName,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    candidates: topBrand.wines.slice(0, 8).map((w: any) => ({
                      item_no: w.item_no,
                      item_name: w.wine_kr,
                      score: w.score,
                      method: 'llm_expand_brand',
                      supply_price: w.price,
                    })),
                  };
                }
              }
            } catch { /* skip */ }
          }

          // 2) 브랜드 매칭 실패 시 가중치 매칭 재시도
          if (!bestResult || (bestResult.score ?? 0) < 0.4) {
            for (const eq of expanded.expandedQueries.slice(0, 2)) {
              try {
                const reResolved = await resolveItemsByClientWeighted(
                  clientCode,
                  [{ ...item, name: eq, _originalIndex: item._originalIndex }],
                  { minScore: 0.4, minGap: 0.03, topN: 5 },
                );
                if (reResolved.length > 0) {
                  const rr = reResolved[0];
                  const rrScore = rr?.score ?? (rr?.candidates?.[0]?.score ?? 0);
                  if (!bestResult || rrScore > (bestResult.score ?? 0)) {
                    bestResult = { ...rr, llm_expanded: expanded.wineName, method: 'llm_expand_weighted' };
                  }
                }
              } catch { /* skip */ }
            }
          }

          if (bestResult && (bestResult.score ?? 0) > topScore) {
            logger.debug(`[LLM Expand] 개선됨`, { name: item.name, before: topScore, after: bestResult.score });
            expandedResults.push(bestResult);
            continue;
          }
        }
      } catch (err) {
        logger.error(`[LLM Expand] 오류`, err);
      }
    }
    expandedResults.push(item);
  }

  return expandedResults;
}
