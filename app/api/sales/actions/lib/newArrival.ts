import { supabase } from '@/app/lib/db';
import { extractGrapesFromName, extractTypeFromName } from './constants';
import type { ClientAgg, ClientPreference, NewArrivalMatch, WineMeta } from './types';

type NewWineInfo = {
  item_name: string;
  country: string;
  grapes: string[];
  wine_type: string;
  supply_price: number;
  available_stock: number;
  incoming_stock: number;
};

/**
 * 신규 와인 목록 구축: wines.status='new' + inventory_cdv.incoming_stock>0.
 */
async function loadNewWineMap(wineMetaMap: Map<string, WineMeta>): Promise<Map<string, NewWineInfo>> {
  const newWineMap = new Map<string, NewWineInfo>();

  // 1) wines status='new' 최대 20건
  const { data: newWines } = await supabase
    .from('wines')
    .select('item_code, item_name_kr, country, grape_varieties, wine_type, supply_price, available_stock')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(20);

  for (const w of newWines || []) {
    const grapes = w.grape_varieties
      ? String(w.grape_varieties).split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean)
      : extractGrapesFromName(w.item_name_kr || '');
    const wType = w.wine_type || extractTypeFromName(w.item_name_kr || '');
    newWineMap.set(w.item_code, {
      item_name: w.item_name_kr || w.item_code,
      country: w.country || '',
      grapes,
      wine_type: wType,
      supply_price: w.supply_price || 0,
      available_stock: w.available_stock || 0,
      incoming_stock: 0,
    });
  }

  // 2) inventory_cdv.incoming_stock > 0 으로 20까지 채움
  if (newWineMap.size < 20) {
    const remaining = 20 - newWineMap.size;
    const { data: incomingItems } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, supply_price, available_stock, incoming_stock')
      .gt('incoming_stock', 0)
      .limit(remaining + 50);

    for (const inv of incomingItems || []) {
      if (newWineMap.size >= 20) break;
      if (newWineMap.has(inv.item_no)) {
        const existing = newWineMap.get(inv.item_no)!;
        existing.incoming_stock = inv.incoming_stock || 0;
        continue;
      }
      const meta = wineMetaMap.get(inv.item_no);
      const grapes = meta?.grapes || extractGrapesFromName(inv.item_name || '');
      const wType = meta?.wineType || extractTypeFromName(inv.item_name || '');
      newWineMap.set(inv.item_no, {
        item_name: inv.item_name || inv.item_no,
        country: meta?.country || '',
        grapes: Array.isArray(grapes) ? grapes : [],
        wine_type: wType,
        supply_price: inv.supply_price || 0,
        available_stock: inv.available_stock || 0,
        incoming_stock: inv.incoming_stock || 0,
      });
    }
  }

  // 3) 현재 재고/입고 최신화 (wines에만 있는 항목도 반영)
  if (newWineMap.size > 0) {
    const wineItemCodes = Array.from(newWineMap.keys());
    for (let i = 0; i < wineItemCodes.length; i += 500) {
      const batch = wineItemCodes.slice(i, i + 500);
      const { data: invData } = await supabase
        .from('inventory_cdv')
        .select('item_no, incoming_stock, available_stock')
        .in('item_no', batch);
      for (const d of invData || []) {
        const w = newWineMap.get(d.item_no);
        if (w) {
          if (d.incoming_stock > 0) w.incoming_stock = d.incoming_stock;
          if (d.available_stock > 0) w.available_stock = d.available_stock;
        }
      }
    }
  }

  return newWineMap;
}

/**
 * 신규 와인 → 거래처 취향 매칭 (country + grape + type + price).
 */
export async function detectNewArrivalMatches(
  clientPrefs: Map<string, ClientPreference>,
  clientMap: Map<string, ClientAgg>,
  importanceMap: Map<string, number | null>,
  wineMetaMap: Map<string, WineMeta>,
): Promise<NewArrivalMatch[]> {
  const newWineMap = await loadNewWineMap(wineMetaMap);
  const matches: NewArrivalMatch[] = [];

  for (const [itemNo, wine] of newWineMap) {
    const matchedClients: NewArrivalMatch['matched_clients'] = [];

    for (const [clientCode, pref] of clientPrefs) {
      if (pref.totalOrders < 3) continue;

      let score = 0;
      const reasons: string[] = [];
      const totalOrders = pref.totalOrders;

      if (wine.country) {
        const countryHits = pref.countryCount.get(wine.country) || 0;
        if (countryHits > 0) {
          score += 30 * (countryHits / totalOrders);
          reasons.push('같은 국가');
        }
      }

      if (wine.grapes.length > 0) {
        let grapeHits = 0;
        for (const g of wine.grapes) grapeHits += (pref.grapeCount.get(g) || 0);
        if (grapeHits > 0) {
          score += 30 * (grapeHits / totalOrders);
          reasons.push('같은 품종');
        }
      }

      if (wine.wine_type) {
        const typeHits = pref.typeCount.get(wine.wine_type) || 0;
        if (typeHits > 0) {
          score += 20 * (typeHits / totalOrders);
          reasons.push('같은 타입');
        }
      }

      if (wine.supply_price > 0 && pref.totalAmount > 0 && pref.totalOrders > 0) {
        const avgPrice = pref.totalAmount / pref.totalOrders;
        if (avgPrice > 0) {
          const priceDiffRatio = Math.abs(wine.supply_price - avgPrice) / avgPrice;
          if (priceDiffRatio <= 0.5) {
            score += 20 * (1 - priceDiffRatio);
            reasons.push('가격대 적합');
          }
        }
      }

      const finalScore = Math.round(score);
      if (finalScore < 20) continue;

      const clientAgg = clientMap.get(clientCode);
      matchedClients.push({
        client_code: clientCode,
        client_name: clientAgg?.client_name || clientCode,
        importance: importanceMap.get(clientCode) ?? null,
        match_score: finalScore,
        match_reasons: reasons,
        avg_purchase_price: pref.totalOrders > 0 ? Math.round(pref.totalAmount / pref.totalOrders) : 0,
      });
    }

    matchedClients.sort((a, b) => b.match_score - a.match_score);
    matchedClients.splice(5);
    if (matchedClients.length === 0) continue;

    matches.push({
      type: 'new_arrival_match',
      item_no: itemNo,
      item_name: wine.item_name,
      country: wine.country,
      wine_type: wine.wine_type,
      grape: wine.grapes.join(', '),
      supply_price: wine.supply_price,
      incoming_stock: wine.incoming_stock,
      available_stock: wine.available_stock,
      matched_clients: matchedClients,
    });
  }

  matches.sort((a, b) => {
    const maxA = a.matched_clients[0]?.match_score || 0;
    const maxB = b.matched_clients[0]?.match_score || 0;
    return maxB - maxA;
  });
  matches.splice(20);
  return matches;
}
