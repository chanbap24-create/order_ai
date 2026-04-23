import { extractGrapesFromName, extractTypeFromName, getSeasonInfo } from './constants';
import type { ClientAgg, ClientPreference, InvInfo, SeasonRecommendation, WineMeta } from './types';

/**
 * 다음달 시즌에 맞는 와인 + 거래처 취향 매칭 top5.
 */
export function detectSeasonRecommendations(
  currentMonth: number,
  clientPrefs: Map<string, ClientPreference>,
  clientMap: Map<string, ClientAgg>,
  importanceMap: Map<string, number | null>,
  wineMetaMap: Map<string, WineMeta>,
  fullInvMap: Map<string, InvInfo>,
): { recos: SeasonRecommendation[]; seasonName: string; targetMonth: number; seasonChange: boolean } {
  const targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const currentSeason = getSeasonInfo(currentMonth);
  const nextSeason = getSeasonInfo(targetMonth);
  const seasonName = nextSeason.season;
  const seasonChange = currentSeason.season !== nextSeason.season;

  // 시즌 적합 와인 선별 (타입+품종 매칭)
  const seasonWines: {
    item_no: string; item_name: string; country: string;
    wine_type: string; grape: string; supply_price: number;
    available_stock: number; season_fit_score: number;
  }[] = [];

  for (const [itemNo, inv] of fullInvMap) {
    const meta = wineMetaMap.get(itemNo);
    const wType = meta?.wineType || extractTypeFromName(inv.item_name);
    const grapes = meta?.grapes || extractGrapesFromName(inv.item_name);
    const country = meta?.country || '';

    let score = 0;

    if (nextSeason.types.length > 0 && wType) {
      const typeMatch = nextSeason.types.some((t) => wType === t);
      if (typeMatch) score += 40;
    }

    if (nextSeason.grapes.length > 0 && grapes.length > 0) {
      const grapeMatch = grapes.some((g) => nextSeason.grapes.some((sg) => g === sg));
      if (grapeMatch) score += 30;
    }

    if (score < 30) continue;

    seasonWines.push({
      item_no: itemNo,
      item_name: inv.item_name,
      country,
      wine_type: wType,
      grape: grapes.join(', '),
      supply_price: inv.supply_price,
      available_stock: inv.available_stock,
      season_fit_score: score,
    });
  }

  seasonWines.sort((a, b) => b.season_fit_score - a.season_fit_score);
  seasonWines.splice(50);

  const recos: SeasonRecommendation[] = [];

  for (const wine of seasonWines) {
    const matchedClients: SeasonRecommendation['matched_clients'] = [];

    for (const [clientCode, pref] of clientPrefs) {
      if (pref.totalOrders < 3) continue;

      let clientScore = 0;
      const reasons: string[] = [];
      const totalOrders = pref.totalOrders;

      if (wine.country) {
        const countryHits = pref.countryCount.get(wine.country) || 0;
        if (countryHits > 0) {
          clientScore += Math.min(20 * (countryHits / totalOrders), 20);
          reasons.push('같은 국가');
        }
      }

      if (wine.grape) {
        const wineGrapes = wine.grape.split(', ').filter(Boolean);
        let grapeHits = 0;
        for (const g of wineGrapes) grapeHits += (pref.grapeCount.get(g) || 0);
        if (grapeHits > 0) {
          clientScore += Math.min(20 * (grapeHits / totalOrders), 20);
          reasons.push('같은 품종');
        }
      }

      if (wine.supply_price > 0 && pref.totalAmount > 0 && pref.totalOrders > 0) {
        const avgPrice = pref.totalAmount / pref.totalOrders;
        if (avgPrice > 0) {
          const priceDiffRatio = Math.abs(wine.supply_price - avgPrice) / avgPrice;
          if (priceDiffRatio <= 0.5) {
            clientScore += Math.round(10 * (1 - priceDiffRatio));
            reasons.push('가격대 적합');
          }
        }
      }

      if (clientScore < 5) continue;

      // season_fit + client_match → 0~100 정규화 (max 70+50=120)
      const totalScore = wine.season_fit_score + clientScore;
      const normalizedScore = Math.round((totalScore / 120) * 100);
      if (normalizedScore < 50) continue;

      const clientAgg = clientMap.get(clientCode);
      matchedClients.push({
        client_code: clientCode,
        client_name: clientAgg?.client_name || clientCode,
        importance: importanceMap.get(clientCode) ?? null,
        match_score: normalizedScore,
        match_reasons: reasons,
      });
    }

    matchedClients.sort((a, b) => b.match_score - a.match_score);
    matchedClients.splice(5);
    if (matchedClients.length === 0) continue;

    recos.push({
      type: 'season_recommendation',
      season_name: seasonName,
      target_month: targetMonth,
      season_change: seasonChange,
      item_no: wine.item_no,
      item_name: wine.item_name,
      country: wine.country,
      wine_type: wine.wine_type,
      grape: wine.grape,
      supply_price: wine.supply_price,
      available_stock: wine.available_stock,
      season_fit_score: wine.season_fit_score,
      matched_clients: matchedClients,
    });
  }

  recos.sort((a, b) => {
    const maxA = a.matched_clients[0]?.match_score || 0;
    const maxB = b.matched_clients[0]?.match_score || 0;
    return maxB - maxA;
  });
  recos.splice(20);

  return { recos, seasonName, targetMonth, seasonChange };
}
