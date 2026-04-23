import { supabase } from "@/app/lib/db";
import { stripQtyAndUnit, normTight, isSpecificAlias } from "./normalize";
import {
  LEARNING_BONUS, RECENT_PURCHASE_BONUS, FREQUENCY_BONUS,
  TOKEN_MATCH_BONUS, ALIAS_MATCH_BONUS,
} from "./constants";
import type {
  LearningSignal, RecentPurchaseSignal, FrequencySignal,
  TokenMatchSignal, AliasMatchSignal,
} from "./types";

/* ================= 신호 1: 사용자 학습 ================= */

export async function getUserLearningSignal(
  rawInput: string, itemNo: string, clientCode?: string,
): Promise<LearningSignal> {
  try {
    const inputItem = stripQtyAndUnit(rawInput);
    const nInputItem = normTight(inputItem);

    let rows: Array<{ alias: string; canonical: string; count: number; client_code?: string | null }> = [];

    if (clientCode) {
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical, count, client_code')
        .eq('canonical', itemNo);

      if (data) {
        rows = data
          .filter(r =>
            r.client_code === clientCode ||
            r.client_code === '*' ||
            !r.client_code
          )
          .sort((a, b) => {
            const priorityA = a.client_code === clientCode ? 1 : a.client_code === '*' ? 2 : 3;
            const priorityB = b.client_code === clientCode ? 1 : b.client_code === '*' ? 2 : 3;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return (b.count || 0) - (a.count || 0);
          });
      }
    } else {
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical, count, client_code')
        .eq('canonical', itemNo);
      if (data) rows = data;
    }

    if (!rows?.length) return { score: 0, count: 0, kind: null };

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
  } catch {
    return { score: 0, count: 0, kind: null };
  }
}

/* ================= 신호 2: 최근 구매 ================= */

export async function getRecentPurchaseSignal(
  clientCode: string, itemNo: string, dataType: 'wine' | 'glass' = 'wine',
): Promise<RecentPurchaseSignal> {
  try {
    const table = dataType === 'glass' ? 'glass_client_item_stats' : 'client_item_stats';
    const { data } = await supabase
      .from(table)
      .select('updated_at')
      .eq('client_code', clientCode)
      .eq('item_no', itemNo)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.updated_at) {
      const lastDate = new Date(data.updated_at);
      const daysAgo = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      let score = 0;
      if (daysAgo <= 7) score = RECENT_PURCHASE_BONUS.WITHIN_7_DAYS;
      else if (daysAgo <= 30) score = RECENT_PURCHASE_BONUS.WITHIN_30_DAYS;
      else if (daysAgo <= 90) score = RECENT_PURCHASE_BONUS.WITHIN_90_DAYS;
      else score = RECENT_PURCHASE_BONUS.OLDER;

      return { score, lastPurchaseDaysAgo: daysAgo };
    }

    return { score: 0, lastPurchaseDaysAgo: null };
  } catch {
    return { score: 0, lastPurchaseDaysAgo: null };
  }
}

/* ================= 신호 3: 구매 빈도 ================= */

export async function getPurchaseFrequencySignal(
  clientCode: string, itemNo: string, dataType: 'wine' | 'glass' = 'wine',
): Promise<FrequencySignal> {
  try {
    const table = dataType === 'glass' ? 'glass_client_item_stats' : 'client_item_stats';
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('client_code', clientCode)
      .eq('item_no', itemNo);

    const purchaseCount = count || 0;
    let score = 0;

    if (purchaseCount >= 10) score = FREQUENCY_BONUS.VERY_HIGH;
    else if (purchaseCount >= 5) score = FREQUENCY_BONUS.HIGH;
    else if (purchaseCount >= 2) score = FREQUENCY_BONUS.MEDIUM;
    else if (purchaseCount >= 1) score = FREQUENCY_BONUS.LOW;

    return { score, purchaseCount };
  } catch {
    return { score: 0, purchaseCount: 0 };
  }
}

/* ================= 신호 4: 토큰 매칭 ================= */

export async function getTokenMatchSignal(
  rawInput: string, itemNo: string,
): Promise<TokenMatchSignal> {
  try {
    const { data: tokens } = await supabase
      .from('token_mapping')
      .select('token, learned_count')
      .ilike('mapped_text', itemNo);

    if (!tokens || tokens.length === 0) {
      return { score: 0, matchedTokens: [], learnedCount: 0 };
    }

    const lowerInput = rawInput.toLowerCase();
    const matchedTokens: string[] = [];
    let totalLearnedCount = 0;

    for (const t of tokens) {
      if (lowerInput.includes(t.token.toLowerCase())) {
        matchedTokens.push(t.token);
        totalLearnedCount += t.learned_count;
      }
    }

    if (matchedTokens.length === 0) {
      return { score: 0, matchedTokens: [], learnedCount: 0 };
    }

    const avgLearnedCount = totalLearnedCount / matchedTokens.length;
    let score = TOKEN_MATCH_BONUS.BASE;

    if (avgLearnedCount >= 10) score += TOKEN_MATCH_BONUS.HIGH_FREQUENCY;
    else if (avgLearnedCount >= 5) score += TOKEN_MATCH_BONUS.MEDIUM_FREQUENCY;
    else score += TOKEN_MATCH_BONUS.LOW_FREQUENCY;

    return { score, matchedTokens, learnedCount: totalLearnedCount };
  } catch (e) {
    console.error('[getTokenMatchSignal] 에러:', e);
    return { score: 0, matchedTokens: [], learnedCount: 0 };
  }
}

/* ================= 신호 5: 별칭 매칭 ================= */

export async function getAliasMatchSignal(
  rawInput: string, itemNo: string,
): Promise<AliasMatchSignal> {
  try {
    const { data: aliases } = await supabase
      .from('item_alias')
      .select('alias, count')
      .ilike('canonical', itemNo);

    if (!aliases || aliases.length === 0) {
      return { score: 0, matchedAlias: null, useCount: 0 };
    }

    const lowerInput = rawInput.toLowerCase();

    for (const a of aliases.sort((x, y) => y.count - x.count)) {
      if (lowerInput.includes(a.alias.toLowerCase())) {
        let score = ALIAS_MATCH_BONUS.BASE;

        if (a.count >= 10) score += ALIAS_MATCH_BONUS.HIGH_USE;
        else if (a.count >= 5) score += ALIAS_MATCH_BONUS.MEDIUM_USE;
        else score += ALIAS_MATCH_BONUS.LOW_USE;

        return { score, matchedAlias: a.alias, useCount: a.count };
      }
    }

    return { score: 0, matchedAlias: null, useCount: 0 };
  } catch (e) {
    console.error('[getAliasMatchSignal] 에러:', e);
    return { score: 0, matchedAlias: null, useCount: 0 };
  }
}
