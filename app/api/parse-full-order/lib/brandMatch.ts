import { hierarchicalSearch } from "@/app/lib/brandMatcher";
import { logger } from "@/app/lib/logger";

/**
 * 각 parsedItem에 대해 brandMatcher.hierarchicalSearch로 브랜드 우선 매칭 시도.
 * 성공 건은 brandMatchedItems 배열에 _originalIndex 포함하여 반환.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runBrandMatch(parsedItems: any[]): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandMatchedItems: any[] = [];
  logger.debug("[BrandMatch] 브랜드 우선 매칭 시작");

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];
    const inputName = item.name || '';
    if (!inputName) continue;

    try {
      let brandResults = await hierarchicalSearch(inputName, 0.5, 0.5, 2);

      // LLM 확장 키워드로 재시도 (primary 실패 시)
      const llmExpanded = item._llmExpanded;
      if (brandResults.length === 0 && llmExpanded?.expandedQueries) {
        for (const eq of llmExpanded.expandedQueries) {
          if (eq === inputName) continue;
          const altResults = await hierarchicalSearch(eq, 0.4, 0.4, 2);
          if (altResults.length > 0 && altResults[0].wines.length > 0) {
            console.log(`[BrandMatch+LLM] "${item._originalName}" → "${eq}" 로 브랜드 매칭 성공`);
            brandResults = altResults;
            break;
          }
        }
      }

      if (brandResults.length > 0 && brandResults[0].wines.length > 0) {
        const topBrand = brandResults[0];
        const topWine = topBrand.wines[0];

        logger.debug(`[BrandMatch] 매칭`, {
          input: inputName, brand: topBrand.brand.supplier_kr,
          wine: topWine.wine_kr, score: topWine.score,
        });

        brandMatchedItems.push({
          _originalIndex: i,
          raw: item.raw,
          name: item._originalName || item.name,
          qty: item.qty,
          normalized_query: inputName,
          _originalName: item._originalName,
          _llmExpanded: item._llmExpanded,
          // item_no 유효 + 점수 0.7 이상 시 자동 확정
          resolved: !!(topWine.item_no) && topWine.score >= 0.7,
          item_no: topWine.item_no,
          item_name: topWine.wine_kr,
          score: topWine.score,
          method: 'brand_hierarchical',
          supply_price: topWine.price,
          brand_info: {
            brand_name: topBrand.brand.supplier_kr,
            brand_score: topBrand.brand.score,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          candidates: topBrand.wines.slice(0, 5).map((w: any) => ({
            item_no: w.item_no,
            item_name: w.wine_kr,
            score: w.score,
            method: 'brand_hierarchical',
            supply_price: w.price,
          })),
        });
      }
    } catch (err) {
      logger.error(`[BrandMatch] 오류`, err);
    }
  }

  return brandMatchedItems;
}
