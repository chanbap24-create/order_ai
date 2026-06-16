import { extractGrapesFromName, extractTypeFromName, getSeasonInfo } from './patterns';
import { extractEnglish, type RegionHierarchy } from './regions';
import type { ClientPreferences, PurchaseAggEntry, ScoredItem } from './types';
import type { Weights } from './settings';

/**
 * 재고 품목별 스코어링 파이프라인.
 * 재주문 / 산지매칭 / 국가 / 품종 / 타입 / 가격 / 시즌 / 판매속도 조합.
 */
export function scoreRecommendations(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>;
  purchaseAgg: Record<string, PurchaseAggEntry>;
  prefs: ClientPreferences;
  W: Weights;
  maxSales90d: number;
  threeMonthsAgoStr: string;
}): ScoredItem[] {
  const { inventory, wineMap, purchaseAgg, prefs, W, maxSales90d, threeMonthsAgoStr } = params;
  const currentMonth = new Date().getMonth() + 1;
  const seasonInfo = getSeasonInfo(currentMonth);

  const scored: ScoredItem[] = [];

  for (const inv of inventory || []) {
    const itemNo = inv.item_no;
    const wine = wineMap.get(itemNo);
    const invCountry = wine?.country || wine?.country_en || inv.country || '';
    let invGrapes = wine?.grape_varieties || '';
    if (!invGrapes && inv.item_name) {
      const extracted = extractGrapesFromName(inv.item_name);
      if (extracted.length > 0) invGrapes = extracted.join(', ');
    }
    let wineType = wine?.wine_type || '';
    if (!wineType && inv.item_name) {
      wineType = extractTypeFromName(inv.item_name);
    }
    const invPrice = inv.supply_price || 0;
    const candidateH: RegionHierarchy | null = wine?._hierarchy || null;

    let score = 0;
    const tags: string[] = [];
    const reasons: string[] = [];

    const purchase = purchaseAgg[itemNo];

    // A. 재주문 (이미 구매한 와인)
    if (purchase) {
      const isStale = !purchase.lastDate || purchase.lastDate <= threeMonthsAgoStr;
      if (purchase.count >= 2 && isStale) {
        const buyRatio = Math.min(purchase.count / Math.max(prefs.totalPurchases * 0.05, 3), 1);
        score += W.REORDER * buyRatio;
        tags.push('재주문');
        reasons.push(`${purchase.count}회 구매, ${purchase.lastDate || '날짜미상'} 이후 미발주`);
      }
      if (!tags.includes('재주문')) continue;
    }

    // 미구매 와인 점수
    if (!purchase) {
      // B. 산지 계층 매칭
      let regionMatched = false;
      if (candidateH && prefs.hasRegionPrefs && W.REGION_MATCH > 0) {
        if (candidateH.sub_region && prefs.subRegionBuyCount[candidateH.sub_region]) {
          const ratio = prefs.subRegionBuyCount[candidateH.sub_region] / prefs.maxSubRegionBuy;
          score += W.REGION_MATCH * ratio;
          tags.push('선호산지');
          reasons.push(extractEnglish(candidateH.sub_region));
          regionMatched = true;
        } else if (candidateH.major_region && prefs.majorRegionBuyCount[candidateH.major_region]) {
          const ratio = prefs.majorRegionBuyCount[candidateH.major_region] / prefs.maxMajorRegionBuy;
          score += W.REGION_MATCH * ratio * 0.6;
          tags.push('인근산지');
          reasons.push(extractEnglish(candidateH.major_region));
          regionMatched = true;
        } else if (candidateH.super_region && prefs.superRegionBuyCount[candidateH.super_region]) {
          const ratio = prefs.superRegionBuyCount[candidateH.super_region] / prefs.maxSuperRegionBuy;
          score += W.REGION_MATCH * ratio * 0.3;
          tags.push('같은지역');
          reasons.push(candidateH.super_region);
          regionMatched = true;
        }
      }

      // C. 국가 매치 (fallback)
      if (!regionMatched && invCountry && prefs.countryBuyCount[invCountry]) {
        const ratio = prefs.countryBuyCount[invCountry] / prefs.maxCountryBuy;
        score += W.COUNTRY_MATCH * ratio;
        tags.push('선호국가');
        reasons.push(invCountry);
      }

      // D. 품종 매치
      if (invGrapes && prefs.topGrapes.length > 0) {
        let bestRatio = 0;
        let matchedGrape = '';
        for (const [grape, cnt] of prefs.topGrapes) {
          if (invGrapes.toLowerCase().includes(grape.toLowerCase())) {
            const ratio = cnt / prefs.maxGrapeBuy;
            if (ratio > bestRatio) { bestRatio = ratio; matchedGrape = grape; }
          }
        }
        if (bestRatio > 0) {
          score += W.GRAPE_MATCH * bestRatio;
          tags.push('선호품종');
          reasons.push(matchedGrape);
        }
      }

      // E. 와인 타입 매치
      if (wineType && prefs.topTypes.length > 0) {
        let bestTypeRatio = 0;
        let matchedType = '';
        for (const [type, cnt] of prefs.topTypes) {
          if (wineType.toLowerCase().includes(type.toLowerCase())
              || type.toLowerCase().includes(wineType.toLowerCase())) {
            const ratio = cnt / prefs.maxTypeBuy;
            if (ratio > bestTypeRatio) { bestTypeRatio = ratio; matchedType = type; }
          }
        }
        if (bestTypeRatio > 0) {
          score += W.TYPE_MATCH * bestTypeRatio;
          tags.push('선호타입');
          reasons.push(matchedType);
        }
      }

      // F-1. 가격 적합도
      if (prefs.clientAvgPrice > 0 && invPrice > 0) {
        const priceDiff = Math.abs(invPrice - prefs.clientAvgPrice) / prefs.clientAvgPrice;
        if (priceDiff <= 0.2) {
          score += W.PRICE_FIT * (1 - priceDiff / 0.2);
          tags.push('적정가격');
        } else if (invPrice > prefs.clientAvgPrice && priceDiff <= 0.5) {
          const fit = 1 - ((priceDiff - 0.2) / 0.3);
          score += W.UPSELL * fit;
          tags.push('프리미엄');
          reasons.push(`평균가 +${Math.round(priceDiff * 100)}%`);
        } else if (invPrice > prefs.clientAvgPrice) {
          // 평균가 대비 50% 초과 — 가격대를 크게 벗어난 고가 와인 감점(난입 방지).
          // 배수(over)에 비례, 최대 PRICE_FIT*3 까지 차감 → 터무니없는 고가는 순위에서 탈락.
          const over = invPrice / prefs.clientAvgPrice;
          score -= W.PRICE_FIT * Math.min(3, (over - 1.5) * 0.5);
          tags.push('가격높음');
          reasons.push(`평균가 ${over.toFixed(1)}배`);
        }
      }

      // F-2. 시즌 매치
      let seasonMatched = false;
      for (const t of seasonInfo.types) {
        if (wineType.toLowerCase().includes(t.toLowerCase())) { seasonMatched = true; break; }
      }
      if (!seasonMatched) {
        for (const g of seasonInfo.grapes) {
          if (invGrapes.toLowerCase().includes(g.toLowerCase())) { seasonMatched = true; break; }
        }
      }
      if (seasonMatched) {
        score += W.SEASONAL;
        tags.push(seasonInfo.season);
        reasons.push(`${seasonInfo.season} 시즌`);
      }

      // F-3. 판매속도
      const sales90d = inv.avg_sales_90d || 0;
      if (sales90d > 0) {
        score += W.SALES_VELOCITY * (sales90d / maxSales90d);
        if (sales90d >= maxSales90d * 0.3) tags.push('인기');
      }

      // 이력 있는 거래처: 최소 1개 선호 매치 필요
      if (prefs.hasHistory && !tags.some((t) =>
        ['선호산지', '인근산지', '같은지역', '선호국가', '선호품종', '선호타입', '적정가격'].includes(t))) continue;
      if (!prefs.hasHistory && tags.length === 0) continue;
    }

    // 가용재고 0 + 보세에만 있으면 통관필요 태그
    if ((inv.available_stock || 0) <= 0 && (inv.bonded_warehouse || 0) > 0) {
      tags.push('통관필요');
    }

    // 빈티지: 품번 3~4번째 자리 (NV/MV 또는 2자리 연도)
    const vv = String(itemNo).slice(2, 4);
    const vintage = /^\d{2}$/.test(vv)
      ? (Number(vv) >= 50 ? `19${vv}` : `20${vv}`)
      : (['NV', 'MV'].includes(vv.toUpperCase()) ? vv.toUpperCase() : '');

    scored.push({
      item_no: itemNo,
      item_name: inv.item_name,
      country: invCountry,
      region: wine?.region || '',
      grape: invGrapes,
      wine_type: wineType,
      price: invPrice,
      stock: inv._totalStock ?? ((inv.available_stock || 0) + (inv.bonded_warehouse || 0)),
      score: Math.round(score * 10) / 10,
      tags,
      reason: reasons.join(' · ') || '추천 와인',
      buy_count: purchase?.count,
      last_order: purchase?.lastDate,
      image_url: (wine?.image_url as string) || '',
      brand: (wine?.supplier as string) || (wine?.brand as string) || '',
      vintage,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
