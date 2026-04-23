import { extractGrapesFromName, extractTypeFromName } from './constants';
import type { ActionItem, ClientAgg, ReorderNudge, UpsellSuggestion, WineMeta, InvInfo } from './types';

/**
 * 이탈(critical/high) + 재주문(in_stock) 거래처 대상 업셀 추천.
 * Top5 품목 패턴과 같은 country/grape/type 중 20~100% 비싼 품목 매칭.
 */
export function detectUpsellSuggestions(
  actions: ActionItem[],
  combinedNudges: ReorderNudge[],
  clientMap: Map<string, ClientAgg>,
  wineMetaMap: Map<string, WineMeta>,
  fullInvMap: Map<string, InvInfo>,
): UpsellSuggestion[] {
  const targetClientCodes = new Set<string>();
  for (const a of actions) {
    if (a.risk_level === 'critical' || a.risk_level === 'high') targetClientCodes.add(a.client_code);
  }
  for (const n of combinedNudges) {
    if (n.stock_status === 'in_stock' || n.stock_status === 'low_stock') targetClientCodes.add(n.client_code);
  }

  const suggestions: UpsellSuggestion[] = [];
  if (targetClientCodes.size === 0) return suggestions;

  for (const tCode of targetClientCodes) {
    const clientAgg = clientMap.get(tCode);
    if (!clientAgg) continue;

    const topItemEntries = Array.from(clientAgg.items.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    const clientCountries = new Set<string>();
    const clientGrapes = new Set<string>();
    const clientTypes = new Set<string>();
    let maxPrice = 0;

    for (const [itemNo, info] of topItemEntries) {
      const meta = wineMetaMap.get(itemNo);
      if (meta) {
        if (meta.country) clientCountries.add(meta.country);
        for (const g of meta.grapes) clientGrapes.add(g);
        if (meta.wineType) clientTypes.add(meta.wineType);
      } else {
        const grapes = extractGrapesFromName(info.name);
        for (const g of grapes) clientGrapes.add(g);
        const t = extractTypeFromName(info.name);
        if (t) clientTypes.add(t);
      }
      const curInv = fullInvMap.get(itemNo);
      if (curInv && curInv.supply_price > maxPrice) maxPrice = curInv.supply_price;
    }

    if (maxPrice === 0) continue;

    let suggestCount = 0;
    for (const [invItemNo, invInfo] of fullInvMap) {
      if (suggestCount >= 2) break;
      if (clientAgg.items.has(invItemNo)) continue;

      const priceDiff = ((invInfo.supply_price - maxPrice) / maxPrice) * 100;
      if (priceDiff < 20 || priceDiff > 100) continue;

      const meta = wineMetaMap.get(invItemNo);
      if (!meta) continue;

      const reasons: string[] = [];
      if (meta.country && clientCountries.has(meta.country)) reasons.push('같은 국가');
      if (meta.grapes.some((g) => clientGrapes.has(g))) reasons.push('같은 품종');
      if (meta.wineType && clientTypes.has(meta.wineType)) reasons.push('같은 타입');
      if (reasons.length === 0) continue;

      suggestions.push({
        type: 'upsell_suggestion',
        client_code: tCode,
        client_name: clientAgg.client_name,
        current_item_name: topItemEntries[0]?.[1]?.name || '',
        current_price: maxPrice,
        suggested_item_no: invItemNo,
        suggested_item_name: invInfo.item_name,
        suggested_price: invInfo.supply_price,
        price_diff_pct: Math.round(priceDiff),
        match_reason: reasons.join(' · '),
        available_stock: invInfo.available_stock,
      });
      suggestCount++;
    }
  }

  suggestions.splice(20);
  return suggestions;
}
