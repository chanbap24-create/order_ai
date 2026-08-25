import { supabase } from "@/app/lib/db";
import { fetchAllRows } from "@/app/lib/fetchAll";
import { stripQtyAndUnit, normTight, isSpecificAlias } from "./normalize";
import {
  LEARNING_BONUS, RECENT_PURCHASE_BONUS, FREQUENCY_BONUS,
  TOKEN_MATCH_BONUS, ALIAS_MATCH_BONUS,
} from "./constants";
import type {
  LearningSignal, RecentPurchaseSignal, FrequencySignal,
  TokenMatchSignal, AliasMatchSignal, PreloadedScoringData,
} from "./types";

/**
 * 스코어링에 필요한 모든 데이터를 4개 병렬 쿼리로 일괄 로드.
 * 이후 calculateWeightedScoreCached()에서 DB 조회 없이 인메모리 계산.
 */
export async function preloadScoringData(
  clientCode: string,
  dataType: 'wine' | 'glass' = 'wine',
): Promise<PreloadedScoringData> {
  const table = dataType === 'glass' ? 'glass_client_item_stats' : 'client_item_stats';

  // ⚠️ limit(N>1000)은 PostgREST max-rows(1000)를 못 넘는다 → fetchAllRows 페이지네이션 필수.
  // 학습 별칭/토큰/공급가가 1000행에서 잘리면 매칭 정확도가 조용히 저하됨.
  const [aliasRows, statsRows, tokenRows, priceRows] = await Promise.all([
    fetchAllRows<{ alias: string; canonical: string; count: number; client_code: string | null }>((f, t) =>
      supabase.from('item_alias').select('alias, canonical, count, client_code').order('alias').range(f, t)),
    fetchAllRows<{ item_no: string; updated_at: string | null; supply_price: number | null }>((f, t) =>
      supabase.from(table).select('item_no, updated_at, supply_price').eq('client_code', clientCode).order('item_no').range(f, t)),
    fetchAllRows<{ token: string; mapped_text: string; learned_count: number }>((f, t) =>
      supabase.from('token_mapping').select('token, mapped_text, learned_count').order('token').range(f, t)),
    fetchAllRows<{ item_no: string; supply_price: number }>((f, t) =>
      supabase.from('inventory_cdv').select('item_no, supply_price').not('supply_price', 'is', null).order('item_no').range(f, t)),
  ]);

  const clientStats = new Map<string, { updated_at: string | null; supply_price: number | null }>();
  for (const r of statsRows) {
    clientStats.set(String(r.item_no), {
      updated_at: r.updated_at || null,
      supply_price: r.supply_price || null,
    });
  }

  const supplyPrices = new Map<string, number>();
  for (const r of priceRows) {
    if (r.supply_price) supplyPrices.set(String(r.item_no), r.supply_price);
  }

  return {
    itemAliases: aliasRows as PreloadedScoringData['itemAliases'],
    clientStats,
    tokenMappings: tokenRows as PreloadedScoringData['tokenMappings'],
    supplyPrices,
  };
}

export function getUserLearningSignalCached(
  rawInput: string, itemNo: string, clientCode: string,
  aliases: PreloadedScoringData['itemAliases'],
): LearningSignal {
  const inputItem = stripQtyAndUnit(rawInput);
  const nInputItem = normTight(inputItem);

  const rows = aliases
    .filter(r => r.canonical === itemNo)
    .filter(r => r.client_code === clientCode || r.client_code === '*' || !r.client_code)
    .sort((a, b) => {
      const pA = a.client_code === clientCode ? 1 : a.client_code === '*' ? 2 : 3;
      const pB = b.client_code === clientCode ? 1 : b.client_code === '*' ? 2 : 3;
      if (pA !== pB) return pA - pB;
      return (b.count || 0) - (a.count || 0);
    });

  if (!rows.length) return { score: 0, count: 0, kind: null };

  for (const r of rows) {
    const aliasItem = stripQtyAndUnit(r.alias);
    const nAliasItem = normTight(aliasItem);

    if (nAliasItem === nInputItem) {
      const count = r.count || 1;
      const bonus = count >= 3 ? LEARNING_BONUS[3] : count === 2 ? LEARNING_BONUS[2] : LEARNING_BONUS[1];
      const clientBonus = r.client_code === clientCode ? 0.15 : 0;
      return { score: bonus + clientBonus, count, kind: "exact" };
    }

    if (nInputItem.includes(nAliasItem)) {
      const count = r.count || 1;
      const bonus = count >= 3 ? LEARNING_BONUS[3] : count === 2 ? LEARNING_BONUS[2] : LEARNING_BONUS[1];
      const clientBonus = r.client_code === clientCode ? 0.15 : 0;
      if (isSpecificAlias(aliasItem)) {
        return { score: bonus + clientBonus, count, kind: "contains_specific" };
      }
      return { score: (bonus * 0.7) + clientBonus, count, kind: "contains_weak" };
    }
  }

  return { score: 0, count: 0, kind: null };
}

export function getRecentPurchaseSignalCached(
  itemNo: string,
  clientStats: PreloadedScoringData['clientStats'],
): RecentPurchaseSignal {
  const stat = clientStats.get(itemNo);
  if (stat?.updated_at) {
    const lastDate = new Date(stat.updated_at);
    const daysAgo = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    let score = 0;
    if (daysAgo <= 7) score = RECENT_PURCHASE_BONUS.WITHIN_7_DAYS;
    else if (daysAgo <= 30) score = RECENT_PURCHASE_BONUS.WITHIN_30_DAYS;
    else if (daysAgo <= 90) score = RECENT_PURCHASE_BONUS.WITHIN_90_DAYS;
    else score = RECENT_PURCHASE_BONUS.OLDER;
    return { score, lastPurchaseDaysAgo: daysAgo };
  }
  return { score: 0, lastPurchaseDaysAgo: null };
}

export function getPurchaseFrequencySignalCached(
  itemNo: string,
  clientStats: PreloadedScoringData['clientStats'],
): FrequencySignal {
  const exists = clientStats.has(itemNo);
  const purchaseCount = exists ? 1 : 0;
  let score = 0;
  if (purchaseCount >= 1) score = FREQUENCY_BONUS.LOW;
  return { score, purchaseCount };
}

export function getTokenMatchSignalCached(
  rawInput: string, itemNo: string,
  tokenMappings: PreloadedScoringData['tokenMappings'],
): TokenMatchSignal {
  const tokens = tokenMappings.filter(t =>
    t.mapped_text.toLowerCase() === itemNo.toLowerCase()
  );
  if (tokens.length === 0) return { score: 0, matchedTokens: [], learnedCount: 0 };

  const lowerInput = rawInput.toLowerCase();
  const matchedTokens: string[] = [];
  let totalLearnedCount = 0;

  for (const t of tokens) {
    if (lowerInput.includes(t.token.toLowerCase())) {
      matchedTokens.push(t.token);
      totalLearnedCount += t.learned_count;
    }
  }

  if (matchedTokens.length === 0) return { score: 0, matchedTokens: [], learnedCount: 0 };

  const avgLearnedCount = totalLearnedCount / matchedTokens.length;
  let score = TOKEN_MATCH_BONUS.BASE;
  if (avgLearnedCount >= 10) score += TOKEN_MATCH_BONUS.HIGH_FREQUENCY;
  else if (avgLearnedCount >= 5) score += TOKEN_MATCH_BONUS.MEDIUM_FREQUENCY;
  else score += TOKEN_MATCH_BONUS.LOW_FREQUENCY;

  return { score, matchedTokens, learnedCount: totalLearnedCount };
}

export function getAliasMatchSignalCached(
  rawInput: string, itemNo: string,
  aliases: PreloadedScoringData['itemAliases'],
): AliasMatchSignal {
  const matchingAliases = aliases
    .filter(a => a.canonical.toLowerCase() === itemNo.toLowerCase())
    .sort((x, y) => (y.count || 0) - (x.count || 0));

  if (matchingAliases.length === 0) return { score: 0, matchedAlias: null, useCount: 0 };

  const lowerInput = rawInput.toLowerCase();
  for (const a of matchingAliases) {
    if (lowerInput.includes(a.alias.toLowerCase())) {
      let score = ALIAS_MATCH_BONUS.BASE;
      if (a.count >= 10) score += ALIAS_MATCH_BONUS.HIGH_USE;
      else if (a.count >= 5) score += ALIAS_MATCH_BONUS.MEDIUM_USE;
      else score += ALIAS_MATCH_BONUS.LOW_USE;
      return { score, matchedAlias: a.alias, useCount: a.count };
    }
  }

  return { score: 0, matchedAlias: null, useCount: 0 };
}
