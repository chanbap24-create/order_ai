import { extractGrapesFromName, extractTypeFromName, getSeasonInfo } from './patterns';
import type { Weights } from './settings';
import type { ClientAnalysis, ScoredItem } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Inv = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WineMeta = Map<string, any>;

/**
 * inventory 후보에 대해 재주문/국가/품종/타입/가격/시즌/속도 점수화.
 * priceFloor/Ceiling 범위 밖은 신규 후보에서 제외.
 */
export function scoreCandidates(params: {
  inventory: Inv[];
  wineMap: WineMeta;
  clientAnalysis: ClientAnalysis;
  W: Weights;
  now: Date;
}): ScoredItem[] {
  const { inventory, wineMap, clientAnalysis, W, now } = params;
  const {
    purchaseAgg, totalPurchases, avgPrice,
    countryCount, grapeCount, typeCount,
  } = clientAnalysis;

  const maxCountryBuy = Math.max(...Object.values(countryCount), 1);
  const maxGrapeBuy = Math.max(...Object.values(grapeCount), 1);
  const maxTypeBuy = Math.max(...Object.values(typeCount), 1);

  const currentMonth = now.getMonth() + 1;
  const seasonInfo = getSeasonInfo(currentMonth);

  let maxSales90d = 1;
  for (const inv of inventory) {
    if ((inv.avg_sales_90d || 0) > maxSales90d) maxSales90d = inv.avg_sales_90d;
  }

  const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

  // 가격대 필터
  const hasPurchaseHistory = totalPurchases > 0 && avgPrice > 0;
  const priceFloor = hasPurchaseHistory ? Math.max(avgPrice * 0.3, 10000) : 15000;
  const priceCeiling = hasPurchaseHistory ? avgPrice * 3.0 : 500000;

  const scored: ScoredItem[] = [];

  for (const inv of inventory) {
    const itemNo = inv.item_no;
    const wine = wineMap.get(itemNo);
    const invCountry = wine?.country || wine?.country_en || inv.country || '';
    let invGrapes = wine?.grape_varieties || '';
    if (!invGrapes && inv.item_name) {
      const extracted = extractGrapesFromName(inv.item_name);
      if (extracted.length > 0) invGrapes = extracted.join(', ');
    }
    let wineType = wine?.wine_type || '';
    if (!wineType && inv.item_name) wineType = extractTypeFromName(inv.item_name);
    const invPrice = inv.supply_price || 0;

    let score = 0;
    const tags: string[] = [];
    const reasons: string[] = [];
    const purchase = purchaseAgg[itemNo];

    // 재주문
    if (purchase) {
      const isStale = !purchase.lastDate || purchase.lastDate <= threeMonthsAgoStr;
      if (purchase.count >= 2 && isStale) {
        const buyRatio = Math.min(purchase.count / Math.max(totalPurchases * 0.05, 3), 1);
        score += W.REORDER * buyRatio;
        tags.push('재주문');
        reasons.push(`${purchase.count}회 구매`);
      }
      if (!tags.includes('재주문')) continue;
    }

    // 신규 후보
    if (!purchase) {
      if (invPrice > 0 && (invPrice < priceFloor || invPrice > priceCeiling)) continue;

      if (invCountry && countryCount[invCountry]) {
        score += W.COUNTRY_MATCH * (countryCount[invCountry] / maxCountryBuy);
        tags.push('선호국가');
      }
      if (invGrapes) {
        for (const [grape, cnt] of Object.entries(grapeCount)) {
          if (invGrapes.toLowerCase().includes(grape.toLowerCase())) {
            score += W.GRAPE_MATCH * (cnt / maxGrapeBuy);
            tags.push('선호품종');
            break;
          }
        }
      }
      if (wineType && typeCount[wineType]) {
        score += W.TYPE_MATCH * (typeCount[wineType] / maxTypeBuy);
        tags.push('선호타입');
      }

      // 가격 적합도 슬라이딩
      if (avgPrice > 0 && invPrice > 0) {
        const ratio = invPrice / avgPrice;
        if (ratio >= 0.7 && ratio <= 1.3) {
          const dist = Math.abs(1 - ratio) / 0.3;
          score += W.PRICE_FIT * (1 - dist * 0.7);
          tags.push('적정가격');
        } else if (ratio > 1.3 && ratio <= 2.0) {
          const fit = 1 - (ratio - 1.3) / 0.7;
          score += W.UPSELL * fit;
          tags.push('프리미엄');
        }
      }

      // 시즌
      let seasonMatched = false;
      for (const t of seasonInfo.types) {
        if (wineType.toLowerCase().includes(t.toLowerCase())) { seasonMatched = true; break; }
      }
      if (!seasonMatched) {
        for (const g of seasonInfo.grapes) {
          if (invGrapes.toLowerCase().includes(g.toLowerCase())) { seasonMatched = true; break; }
        }
      }
      if (seasonMatched) { score += W.SEASONAL; tags.push(seasonInfo.season); }

      const sales90d = inv.avg_sales_90d || 0;
      if (sales90d > 0) score += W.SALES_VELOCITY * (sales90d / maxSales90d);

      if (totalPurchases > 0 && !tags.some((t) => ['선호국가', '선호품종', '선호타입', '적정가격'].includes(t))) continue;
      if (totalPurchases === 0 && tags.length === 0) continue;
    }

    scored.push({
      item_no: itemNo,
      item_name: inv.item_name,
      score: Math.round(score * 10) / 10,
      tags,
      reason: reasons.join(' · ') || tags.join(' · '),
      price: invPrice,
      stock: inv._totalStock ?? (Number(inv.stock_total) || 0),
      country: invCountry,
      region: wine?.region || '',
      grape: invGrapes,
      wine_type: wineType,
      brand: inv.brand || '',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 점수순 상위 15개 후보 → brand 중복 제한(최대 2) → 최종 10개 정렬.
 * 재주문 우선 + 점수대 5점 그룹 + 타입 순서 + 가격 내림차순.
 */
export function diversifyAndRank(candidates: ScoredItem[]): ScoredItem[] {
  const top15 = candidates.slice(0, 15);

  const brandCount: Record<string, number> = {};
  const diversified: ScoredItem[] = [];
  for (const item of top15) {
    const b = item.brand;
    if (b) {
      brandCount[b] = (brandCount[b] || 0) + 1;
      if (brandCount[b] > 2) continue;
    }
    diversified.push(item);
  }

  const typeOrder: Record<string, number> = { '레드': 0, '화이트': 1, '스파클링': 2, '로제': 3 };
  diversified.sort((a, b) => {
    const aReorder = a.tags.includes('재주문') ? 0 : 1;
    const bReorder = b.tags.includes('재주문') ? 0 : 1;
    if (aReorder !== bReorder) return aReorder - bReorder;
    const aGroup = Math.floor(a.score / 5);
    const bGroup = Math.floor(b.score / 5);
    if (aGroup !== bGroup) return bGroup - aGroup;
    const aType = typeOrder[a.wine_type] ?? 4;
    const bType = typeOrder[b.wine_type] ?? 4;
    if (aType !== bType) return aType - bType;
    return b.price - a.price;
  });

  return diversified.slice(0, 10);
}
