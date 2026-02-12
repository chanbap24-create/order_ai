/**
 * ========================================
 * 조합 가중치 시스템 (Weighted Scoring Engine)
 * ========================================
 *
 * 여러 신호(signal)를 종합해서 "이 와인이 정답일 확률"을 계산합니다.
 *
 * 신호 종류:
 * 1. 사용자 학습 (User Learning) - 사용자가 명시적으로 선택한 이력
 * 2. 최근 구매 (Recent Purchase) - 거래처가 최근에 구매한 이력
 * 3. 구매 빈도 (Purchase Frequency) - 거래처가 자주 구매하는 품목
 * 4. 빈티지 (Vintage) - 최신 빈티지 우선
 * 5. 기본 점수 (Base Score) - 문자열 유사도
 */

import { supabase } from "@/app/lib/db";

/* ==================== 가중치 설정 ==================== */

// 신호별 중요도 (multiplier)
export const SIGNAL_WEIGHTS = {
  BASE_SCORE: 1.0,         // 🎯 기본 문자열 유사도 (0~1 범위 유지)
  USER_LEARNING: 0.30,     // 사용자 학습 보너스
  TOKEN_MATCH: 0.25,       // 토큰 매칭 (학습된 토큰)
  ALIAS_MATCH: 0.20,       // 별칭 매칭 (학습된 별칭)
  RECENT_PURCHASE: 0.15,   // 최근 구매 이력
  PURCHASE_FREQUENCY: 0.10, // 구매 빈도
  VINTAGE: 0.05,           // 빈티지
};

// 사용자 학습 카운트별 보너스
export const LEARNING_BONUS = {
  1: 0.20,  // 1회 선택
  2: 0.30,  // 2회 선택
  3: 0.40,  // 3회+ 선택
};

// 최근 구매일별 보너스
export const RECENT_PURCHASE_BONUS = {
  WITHIN_7_DAYS: 0.20,   // 최근 7일
  WITHIN_30_DAYS: 0.15,  // 최근 30일
  WITHIN_90_DAYS: 0.10,  // 최근 90일
  OLDER: 0.05,           // 90일 이상
};

// 구매 빈도별 보너스
export const FREQUENCY_BONUS = {
  VERY_HIGH: 0.15,  // 10회 이상
  HIGH: 0.10,       // 5~9회
  MEDIUM: 0.05,     // 2~4회
  LOW: 0.02,        // 1회
};

// 토큰 매칭 보너스
export const TOKEN_MATCH_BONUS = {
  BASE: 0.20,              // 기본 토큰 매칭
  HIGH_FREQUENCY: 0.10,    // 학습 빈도 높음 (10회+)
  MEDIUM_FREQUENCY: 0.05,  // 학습 빈도 중간 (5~9회)
  LOW_FREQUENCY: 0.02,     // 학습 빈도 낮음 (1~4회)
};

// 별칭 매칭 보너스
export const ALIAS_MATCH_BONUS = {
  BASE: 0.15,              // 기본 별칭 매칭
  HIGH_USE: 0.10,          // 사용 빈도 높음 (10회+)
  MEDIUM_USE: 0.05,        // 사용 빈도 중간 (5~9회)
  LOW_USE: 0.02,           // 사용 빈도 낮음 (1~4회)
};

/* ==================== 유틸리티 함수 ==================== */

function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  // ✅ 단위 포함 수량 제거
  s = s.replace(/(\d+)\s*(병|박스|cs|box|bt|btl|개|잔)/gi, "").trim();
  // ✅ 슬래시/대시 뒤 숫자는 코드 일부이므로 보호 (0330/07의 07을 지우면 안됨)
  s = s.replace(/(?<![\/\-])\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normTight(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

/* ==================== 신호 1: 사용자 학습 ==================== */

interface LearningSignal {
  score: number;
  count: number;
  kind: "exact" | "contains_specific" | "contains_weak" | null;
}

function isSpecificAlias(alias: string) {
  const a = stripQtyAndUnit(alias);
  const tokens = a.split(" ").filter(Boolean);
  const tightLen = normTight(a).length;

  // ✅ 한글 감지: 한글이 50% 이상이면 한글 기준 적용
  const koreanChars = (a.match(/[가-힣]/g) || []).length;
  const totalChars = a.length;
  const isKorean = koreanChars / totalChars > 0.5;

  if (isKorean) {
    // 한글 기준: 2토큰 이상 OR 6글자 이상 (한글은 정보밀도 높음)
    return tokens.length >= 2 || tightLen >= 6;
  } else {
    // 영문 기준: 3토큰 이상 OR 12글자 이상
    return tokens.length >= 3 || tightLen >= 12;
  }
}

export async function getUserLearningSignal(rawInput: string, itemNo: string, clientCode?: string): Promise<LearningSignal> {
  try {
    const inputItem = stripQtyAndUnit(rawInput);
    const nInputItem = normTight(inputItem);

    // ✅ 거래처별 학습 우선 조회
    let rows: Array<{ alias: string; canonical: string; count: number; client_code?: string | null }> = [];

    if (clientCode) {
      // item_alias에서 canonical이 일치하고, client_code가 해당 거래처이거나 전역('*')이거나 null인 것 조회
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical, count, client_code')
        .eq('canonical', itemNo);

      if (data) {
        // JS에서 client_code 필터링 및 정렬
        rows = data
          .filter(r =>
            r.client_code === clientCode ||
            r.client_code === '*' ||
            !r.client_code
          )
          .sort((a, b) => {
            // 거래처별 학습 최우선
            const priorityA = a.client_code === clientCode ? 1 : a.client_code === '*' ? 2 : 3;
            const priorityB = b.client_code === clientCode ? 1 : b.client_code === '*' ? 2 : 3;
            if (priorityA !== priorityB) return priorityA - priorityB;
            // 같은 우선순위면 count 내림차순
            return (b.count || 0) - (a.count || 0);
          });
      }
    } else {
      // clientCode 없으면 기존 방식
      const { data } = await supabase
        .from('item_alias')
        .select('alias, canonical, count, client_code')
        .eq('canonical', itemNo);

      if (data) {
        rows = data;
      }
    }

    if (!rows?.length) return { score: 0, count: 0, kind: null };

    for (const r of rows) {
      const aliasItem = stripQtyAndUnit(r.alias);
      const nAliasItem = normTight(aliasItem);

      // Exact 매칭
      if (nAliasItem === nInputItem) {
        const count = r.count || 1;
        const bonus = count >= 3 ? LEARNING_BONUS[3] : count === 2 ? LEARNING_BONUS[2] : LEARNING_BONUS[1];

        // ✅ 거래처별 학습이면 강력한 보너스 (+0.15)
        const clientBonus = r.client_code === clientCode ? 0.15 : 0;
        return { score: bonus + clientBonus, count, kind: "exact" };
      }

      // Contains 매칭
      if (nInputItem.includes(nAliasItem)) {
        const count = r.count || 1;
        const bonus = count >= 3 ? LEARNING_BONUS[3] : count === 2 ? LEARNING_BONUS[2] : LEARNING_BONUS[1];

        // ✅ 거래처별 학습이면 강력한 보너스 (+0.15)
        const clientBonus = r.client_code === clientCode ? 0.15 : 0;

        if (isSpecificAlias(aliasItem)) {
          return { score: bonus + clientBonus, count, kind: "contains_specific" };
        } else {
          return { score: (bonus * 0.7) + clientBonus, count, kind: "contains_weak" }; // ✅ weak 보너스 상향 (0.5 → 0.7)
        }
      }
    }

    return { score: 0, count: 0, kind: null };
  } catch {
    return { score: 0, count: 0, kind: null };
  }
}

/* ==================== 신호 2: 최근 구매 ==================== */

interface RecentPurchaseSignal {
  score: number;
  lastPurchaseDaysAgo: number | null;
}

export async function getRecentPurchaseSignal(clientCode: string, itemNo: string, dataType: 'wine' | 'glass' = 'wine'): Promise<RecentPurchaseSignal> {
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

/* ==================== 신호 3: 구매 빈도 ==================== */

interface FrequencySignal {
  score: number;
  purchaseCount: number;
}

export async function getPurchaseFrequencySignal(clientCode: string, itemNo: string, dataType: 'wine' | 'glass' = 'wine'): Promise<FrequencySignal> {
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

/* ==================== 신호 4: 토큰 매칭 ==================== */

interface TokenMatchSignal {
  score: number;
  matchedTokens: string[];
  learnedCount: number;
}

async function getTokenMatchSignal(rawInput: string, itemNo: string): Promise<TokenMatchSignal> {
  try {
    // token_mapping에서 해당 품목 검색
    const { data: tokens } = await supabase
      .from('token_mapping')
      .select('token, learned_count')
      .ilike('mapped_text', itemNo);

    if (!tokens || tokens.length === 0) {
      return { score: 0, matchedTokens: [], learnedCount: 0 };
    }

    // 입력 문자열을 소문자로 변환
    const lowerInput = rawInput.toLowerCase();

    // 매칭된 토큰 찾기
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

    // 점수 계산
    const avgLearnedCount = totalLearnedCount / matchedTokens.length;
    let score = TOKEN_MATCH_BONUS.BASE;

    if (avgLearnedCount >= 10) {
      score += TOKEN_MATCH_BONUS.HIGH_FREQUENCY;
    } else if (avgLearnedCount >= 5) {
      score += TOKEN_MATCH_BONUS.MEDIUM_FREQUENCY;
    } else {
      score += TOKEN_MATCH_BONUS.LOW_FREQUENCY;
    }

    return { score, matchedTokens, learnedCount: totalLearnedCount };
  } catch (e) {
    console.error('[getTokenMatchSignal] 에러:', e);
    return { score: 0, matchedTokens: [], learnedCount: 0 };
  }
}

/* ==================== 신호 5: 별칭 매칭 ==================== */

interface AliasMatchSignal {
  score: number;
  matchedAlias: string | null;
  useCount: number;
}

async function getAliasMatchSignal(rawInput: string, itemNo: string): Promise<AliasMatchSignal> {
  try {
    // item_alias에서 해당 품목 검색
    const { data: aliases } = await supabase
      .from('item_alias')
      .select('alias, count')
      .ilike('canonical', itemNo);

    if (!aliases || aliases.length === 0) {
      return { score: 0, matchedAlias: null, useCount: 0 };
    }

    // 입력 문자열을 소문자로 변환
    const lowerInput = rawInput.toLowerCase();

    // 매칭된 별칭 찾기 (가장 많이 사용된 것 우선)
    for (const a of aliases.sort((x, y) => y.count - x.count)) {
      if (lowerInput.includes(a.alias.toLowerCase())) {
        // 점수 계산
        let score = ALIAS_MATCH_BONUS.BASE;

        if (a.count >= 10) {
          score += ALIAS_MATCH_BONUS.HIGH_USE;
        } else if (a.count >= 5) {
          score += ALIAS_MATCH_BONUS.MEDIUM_USE;
        } else {
          score += ALIAS_MATCH_BONUS.LOW_USE;
        }

        return { score, matchedAlias: a.alias, useCount: a.count };
      }
    }

    return { score: 0, matchedAlias: null, useCount: 0 };
  } catch (e) {
    console.error('[getAliasMatchSignal] 에러:', e);
    return { score: 0, matchedAlias: null, useCount: 0 };
  }
}

/* ==================== 신호 6: 빈티지 ==================== */

interface VintageSignal {
  score: number;
  itemVintage: number | null;
}

function getVintageFromItemNo(itemNo: string): number | null {
  const m = String(itemNo).match(/^[A-Z0-9]{2}(\d{2})/i);
  if (!m) return null;

  const yy = Number(m[1]);
  if (yy >= 50) return 1900 + yy;
  return 2000 + yy;
}

function extractVintageHint(raw: string): number | null {
  const s = String(raw || "");
  const m4 = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (m4) return Number(m4[1]);

  const m2 = s.match(/(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/);
  if (!m2) return null;

  const yy = Number(m2[1]);
  if (!Number.isFinite(yy)) return null;

  return yy >= 50 ? 1900 + yy : 2000 + yy;
}

export function getVintageSignal(rawInput: string, itemNo: string): VintageSignal {
  const hintVintage = extractVintageHint(rawInput);
  const itemVintage = getVintageFromItemNo(itemNo);

  if (!itemVintage) return { score: 0, itemVintage: null };

  // 빈티지 힌트가 있으면 일치 여부로 가산/감산
  if (hintVintage) {
    if (hintVintage === itemVintage) {
      return { score: 0.08, itemVintage };
    } else {
      return { score: -0.18, itemVintage };
    }
  }

  // 빈티지 힌트 없으면 최신 빈티지 우선
  const currentYear = new Date().getFullYear();
  const yearDiff = currentYear - itemVintage;

  let score = 0;
  if (yearDiff <= 0) score = 0.20;       // 최신 (올해 또는 미래)
  else if (yearDiff === 1) score = 0.15; // 1년 전
  else if (yearDiff === 2) score = 0.10; // 2년 전
  else score = 0.05;                     // 3년+ 이전

  return { score, itemVintage };
}

/* ==================== 종합 점수 계산 ==================== */

export interface WeightedScore {
  finalScore: number;
  signals: {
    baseScore: number;
    userLearning: LearningSignal;
    recentPurchase: RecentPurchaseSignal;
    purchaseFrequency: FrequencySignal;
    vintage: VintageSignal;
  };
  weights: {
    baseScore: number;
    userLearning: number;
    recentPurchase: number;
    purchaseFrequency: number;
    vintage: number;
  };
  rawTotal: number; // 정규화 전 점수
}

export async function calculateWeightedScore(
  rawInput: string,
  clientCode: string,
  itemNo: string,
  baseScore: number,
  dataType: 'wine' | 'glass' = 'wine',
  supplyPrice?: number // ✅ 공급가 추가
): Promise<WeightedScore> {
  // 각 신호 계산 (병렬로 실행)
  const [userLearning, recentPurchase, purchaseFrequency, tokenMatch, aliasMatch] = await Promise.all([
    getUserLearningSignal(rawInput, itemNo, clientCode), // ✅ clientCode 전달
    getRecentPurchaseSignal(clientCode, itemNo, dataType),
    getPurchaseFrequencySignal(clientCode, itemNo, dataType),
    getTokenMatchSignal(rawInput, itemNo),
    getAliasMatchSignal(rawInput, itemNo),
  ]);
  const vintage = dataType === 'wine' ? getVintageSignal(rawInput, itemNo) : { score: 0, itemVintage: null };

  // 가중치 적용
  const weights = {
    baseScore: baseScore * SIGNAL_WEIGHTS.BASE_SCORE,
    userLearning: userLearning.score * SIGNAL_WEIGHTS.USER_LEARNING,
    tokenMatch: tokenMatch.score * SIGNAL_WEIGHTS.TOKEN_MATCH,
    aliasMatch: aliasMatch.score * SIGNAL_WEIGHTS.ALIAS_MATCH,
    recentPurchase: recentPurchase.score * SIGNAL_WEIGHTS.RECENT_PURCHASE,
    purchaseFrequency: purchaseFrequency.score * SIGNAL_WEIGHTS.PURCHASE_FREQUENCY,
    vintage: vintage.score * SIGNAL_WEIGHTS.VINTAGE,
  };

  // 최종 점수 (정규화 전)
  const rawTotal =
    weights.baseScore +
    weights.userLearning +
    weights.tokenMatch +
    weights.aliasMatch +
    weights.recentPurchase +
    weights.purchaseFrequency +
    weights.vintage;

  // 최종 점수 (0~1 범위로 정규화하지 않고 raw 유지, 정렬용)
  const finalScore = rawTotal;

  return {
    finalScore,
    signals: {
      baseScore,
      userLearning,
      tokenMatch,
      aliasMatch,
      recentPurchase,
      purchaseFrequency,
      vintage,
      supply_price: supplyPrice, // ✅ 공급가 추가
    },
    weights,
    rawTotal,
  };
}

/* ==================== 배치 프리로드 (N+1 쿼리 최적화) ==================== */

export interface PreloadedScoringData {
  itemAliases: Array<{ alias: string; canonical: string; count: number; client_code: string | null }>;
  clientStats: Map<string, { updated_at: string | null; supply_price: number | null }>;
  tokenMappings: Array<{ token: string; mapped_text: string; learned_count: number }>;
  supplyPrices: Map<string, number>;
}

/**
 * 스코어링에 필요한 모든 데이터를 4개 병렬 쿼리로 일괄 로드.
 * 이후 calculateWeightedScoreCached()에서 DB 조회 없이 인메모리 계산.
 */
export async function preloadScoringData(
  clientCode: string,
  dataType: 'wine' | 'glass' = 'wine'
): Promise<PreloadedScoringData> {
  const table = dataType === 'glass' ? 'glass_client_item_stats' : 'client_item_stats';

  const [aliasResult, statsResult, tokenResult, priceResult] = await Promise.all([
    supabase.from('item_alias').select('alias, canonical, count, client_code').limit(10000),
    supabase.from(table).select('item_no, updated_at, supply_price').eq('client_code', clientCode).limit(10000),
    supabase.from('token_mapping').select('token, mapped_text, learned_count').limit(10000),
    supabase.from('inventory_cdv').select('item_no, supply_price').not('supply_price', 'is', null).limit(20000),
  ]);

  const clientStats = new Map<string, { updated_at: string | null; supply_price: number | null }>();
  for (const r of (statsResult.data || []) as any[]) {
    clientStats.set(String(r.item_no), {
      updated_at: r.updated_at || null,
      supply_price: r.supply_price || null,
    });
  }

  const supplyPrices = new Map<string, number>();
  for (const r of (priceResult.data || []) as any[]) {
    if (r.supply_price) supplyPrices.set(String(r.item_no), r.supply_price);
  }

  return {
    itemAliases: (aliasResult.data || []) as any[],
    clientStats,
    tokenMappings: (tokenResult.data || []) as any[],
    supplyPrices,
  };
}

/* ---- 인메모리 시그널 함수 (DB 조회 없음) ---- */

function getUserLearningSignalCached(
  rawInput: string, itemNo: string, clientCode: string,
  aliases: PreloadedScoringData['itemAliases']
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
      } else {
        return { score: (bonus * 0.7) + clientBonus, count, kind: "contains_weak" };
      }
    }
  }

  return { score: 0, count: 0, kind: null };
}

function getRecentPurchaseSignalCached(
  itemNo: string,
  clientStats: PreloadedScoringData['clientStats']
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

function getPurchaseFrequencySignalCached(
  itemNo: string,
  clientStats: PreloadedScoringData['clientStats']
): FrequencySignal {
  const exists = clientStats.has(itemNo);
  const purchaseCount = exists ? 1 : 0;
  let score = 0;
  if (purchaseCount >= 1) score = FREQUENCY_BONUS.LOW;
  return { score, purchaseCount };
}

function getTokenMatchSignalCached(
  rawInput: string, itemNo: string,
  tokenMappings: PreloadedScoringData['tokenMappings']
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

function getAliasMatchSignalCached(
  rawInput: string, itemNo: string,
  aliases: PreloadedScoringData['itemAliases']
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

/* ---- 캐시 기반 종합 점수 계산 (DB 조회 제로) ---- */

export function calculateWeightedScoreCached(
  rawInput: string,
  clientCode: string,
  itemNo: string,
  baseScore: number,
  preloaded: PreloadedScoringData,
  dataType: 'wine' | 'glass' = 'wine',
  supplyPrice?: number
): WeightedScore {
  const userLearning = getUserLearningSignalCached(rawInput, itemNo, clientCode, preloaded.itemAliases);
  const recentPurchase = getRecentPurchaseSignalCached(itemNo, preloaded.clientStats);
  const purchaseFrequency = getPurchaseFrequencySignalCached(itemNo, preloaded.clientStats);
  const tokenMatch = getTokenMatchSignalCached(rawInput, itemNo, preloaded.tokenMappings);
  const aliasMatch = getAliasMatchSignalCached(rawInput, itemNo, preloaded.itemAliases);
  const vintage = dataType === 'wine' ? getVintageSignal(rawInput, itemNo) : { score: 0, itemVintage: null };

  const weights = {
    baseScore: baseScore * SIGNAL_WEIGHTS.BASE_SCORE,
    userLearning: userLearning.score * SIGNAL_WEIGHTS.USER_LEARNING,
    tokenMatch: tokenMatch.score * SIGNAL_WEIGHTS.TOKEN_MATCH,
    aliasMatch: aliasMatch.score * SIGNAL_WEIGHTS.ALIAS_MATCH,
    recentPurchase: recentPurchase.score * SIGNAL_WEIGHTS.RECENT_PURCHASE,
    purchaseFrequency: purchaseFrequency.score * SIGNAL_WEIGHTS.PURCHASE_FREQUENCY,
    vintage: vintage.score * SIGNAL_WEIGHTS.VINTAGE,
  };

  const rawTotal =
    weights.baseScore + weights.userLearning + weights.tokenMatch +
    weights.aliasMatch + weights.recentPurchase + weights.purchaseFrequency + weights.vintage;

  return {
    finalScore: rawTotal,
    signals: {
      baseScore,
      userLearning,
      tokenMatch,
      aliasMatch,
      recentPurchase,
      purchaseFrequency,
      vintage,
      supply_price: supplyPrice,
    },
    weights,
    rawTotal,
  } as WeightedScore;
}
