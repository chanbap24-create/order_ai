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

import { db } from "@/app/lib/db";

/* ==================== 가중치 설정 ==================== */

// 신호별 중요도 (multiplier)
export const SIGNAL_WEIGHTS = {
  USER_LEARNING: 3.0,      // 사용자 학습이 가장 중요!
  RECENT_PURCHASE: 2.0,    // 최근 구매 이력
  PURCHASE_FREQUENCY: 1.5, // 구매 빈도
  VINTAGE: 1.0,            // 빈티지
  BASE_SCORE: 1.0,         // 기본 문자열 유사도
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

/* ==================== 유틸리티 함수 ==================== */

function stripQtyAndUnit(raw: string) {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
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
  return tokens.length >= 3 || tightLen >= 12;
}

export function getUserLearningSignal(rawInput: string, itemNo: string): LearningSignal {
  try {
    const inputItem = stripQtyAndUnit(rawInput);
    const nInputItem = normTight(inputItem);

    const rows = db.prepare(`
      SELECT alias, canonical, count 
      FROM item_alias 
      WHERE canonical = ?
    `).all(itemNo) as Array<{ alias: string; canonical: string; count: number }>;

    if (!rows?.length) return { score: 0, count: 0, kind: null };

    for (const r of rows) {
      const aliasItem = stripQtyAndUnit(r.alias);
      const nAliasItem = normTight(aliasItem);

      // Exact 매칭
      if (nAliasItem === nInputItem) {
        const count = r.count || 1;
        const bonus = count >= 3 ? LEARNING_BONUS[3] : count === 2 ? LEARNING_BONUS[2] : LEARNING_BONUS[1];
        return { score: bonus, count, kind: "exact" };
      }

      // Contains 매칭
      if (nInputItem.includes(nAliasItem)) {
        const count = r.count || 1;
        const bonus = count >= 3 ? LEARNING_BONUS[3] : count === 2 ? LEARNING_BONUS[2] : LEARNING_BONUS[1];
        
        if (isSpecificAlias(aliasItem)) {
          return { score: bonus, count, kind: "contains_specific" };
        } else {
          return { score: bonus * 0.5, count, kind: "contains_weak" }; // weak는 절반만
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

export function getRecentPurchaseSignal(clientCode: string, itemNo: string): RecentPurchaseSignal {
  try {
    // Client 테이블에서 최근 출고일 조회
    const candidates = [
      "Client", "client", "client_rows", "client_history", "client_shipments",
      "client_sales", "client_item_history", "client_item_rows", "sales_client", "sales"
    ];

    for (const table of candidates) {
      try {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        const names = cols.map((c) => String(c.name));

        const clientCodeCol = names.find((n) => 
          ["client_code", "clientCode", "거래처코드", "F"].includes(n)
        );
        const itemNoCol = names.find((n) => 
          ["item_no", "itemNo", "품목번호", "품목코드", "sku", "code", "M"].includes(n)
        );
        const shippedAtCol = names.find((n) => 
          ["shipped_at", "ship_date", "out_date", "출고일", "출고일자", "date", "G"].includes(n)
        );

        if (!clientCodeCol || !itemNoCol || !shippedAtCol) continue;

        const sql = `
          SELECT MAX(${shippedAtCol}) AS last_shipped_at
          FROM ${table}
          WHERE ${clientCodeCol} = ? AND ${itemNoCol} = ?
        `;
        const row = db.prepare(sql).get(clientCode, itemNo) as { last_shipped_at: any } | undefined;

        if (row?.last_shipped_at) {
          const lastDate = new Date(String(row.last_shipped_at));
          const daysAgo = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

          let score = 0;
          if (daysAgo <= 7) score = RECENT_PURCHASE_BONUS.WITHIN_7_DAYS;
          else if (daysAgo <= 30) score = RECENT_PURCHASE_BONUS.WITHIN_30_DAYS;
          else if (daysAgo <= 90) score = RECENT_PURCHASE_BONUS.WITHIN_90_DAYS;
          else score = RECENT_PURCHASE_BONUS.OLDER;

          return { score, lastPurchaseDaysAgo: daysAgo };
        }
      } catch {
        continue;
      }
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

export function getPurchaseFrequencySignal(clientCode: string, itemNo: string): FrequencySignal {
  try {
    const candidates = [
      "Client", "client", "client_rows", "client_history", "client_shipments",
      "client_sales", "client_item_history", "client_item_rows", "sales_client", "sales"
    ];

    for (const table of candidates) {
      try {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        const names = cols.map((c) => String(c.name));

        const clientCodeCol = names.find((n) => 
          ["client_code", "clientCode", "거래처코드", "F"].includes(n)
        );
        const itemNoCol = names.find((n) => 
          ["item_no", "itemNo", "품목번호", "품목코드", "sku", "code", "M"].includes(n)
        );

        if (!clientCodeCol || !itemNoCol) continue;

        const sql = `
          SELECT COUNT(*) AS purchase_count
          FROM ${table}
          WHERE ${clientCodeCol} = ? AND ${itemNoCol} = ?
        `;
        const row = db.prepare(sql).get(clientCode, itemNo) as { purchase_count: number } | undefined;

        if (row) {
          const count = row.purchase_count || 0;
          let score = 0;
          
          if (count >= 10) score = FREQUENCY_BONUS.VERY_HIGH;
          else if (count >= 5) score = FREQUENCY_BONUS.HIGH;
          else if (count >= 2) score = FREQUENCY_BONUS.MEDIUM;
          else if (count >= 1) score = FREQUENCY_BONUS.LOW;

          return { score, purchaseCount: count };
        }
      } catch {
        continue;
      }
    }

    return { score: 0, purchaseCount: 0 };
  } catch {
    return { score: 0, purchaseCount: 0 };
  }
}

/* ==================== 신호 4: 빈티지 ==================== */

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

export function calculateWeightedScore(
  rawInput: string,
  clientCode: string,
  itemNo: string,
  baseScore: number
): WeightedScore {
  // 각 신호 계산
  const userLearning = getUserLearningSignal(rawInput, itemNo);
  const recentPurchase = getRecentPurchaseSignal(clientCode, itemNo);
  const purchaseFrequency = getPurchaseFrequencySignal(clientCode, itemNo);
  const vintage = getVintageSignal(rawInput, itemNo);

  // 가중치 적용
  const weights = {
    baseScore: baseScore * SIGNAL_WEIGHTS.BASE_SCORE,
    userLearning: userLearning.score * SIGNAL_WEIGHTS.USER_LEARNING,
    recentPurchase: recentPurchase.score * SIGNAL_WEIGHTS.RECENT_PURCHASE,
    purchaseFrequency: purchaseFrequency.score * SIGNAL_WEIGHTS.PURCHASE_FREQUENCY,
    vintage: vintage.score * SIGNAL_WEIGHTS.VINTAGE,
  };

  // 최종 점수 (정규화 전)
  const rawTotal =
    weights.baseScore +
    weights.userLearning +
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
      recentPurchase,
      purchaseFrequency,
      vintage,
    },
    weights,
    rawTotal,
  };
}
