/**
 * 품목 매칭 규칙 중앙 관리
 * 
 * 모든 임계값과 규칙을 한 곳에서 관리하여 일관성을 유지합니다.
 */

export const ITEM_MATCH_CONFIG = {
  // 자동 확정 임계값
  autoResolve: {
    minScore: 0.55,           // 최소 점수 (0.55 이상이면 자동 확정 가능) ⭐ 낮춤: 0.60 → 0.55
    minGap: 0.10,             // 최소 점수 차이 (1위와 2위 gap >= 0.10) ⭐ 낮춤: 0.20 → 0.10
    highConfidenceScore: 0.95, // 고신뢰 점수 (0.95 이상이면 gap 0.15만 있어도 확정)
    highConfidenceGap: 0.15,   // 고신뢰 점수 차이
  },

  // 신규품목 검색
  newItemSearch: {
    threshold: 0.70,          // 신규품목 검색 시작 점수 (bestScore < 0.70일 때만)
    maxCandidates: 5,         // 최대 신규품목 후보 수
  },

  // 후보 표시 규칙
  suggestions: {
    total: 8,                 // 총 후보 개수 ⭐ 4 → 8로 증가 (기존 + 신규 더 많이 표시)
    
    // GAP 기반 규칙
    dominantGap: 0.50,        // 압도적 우위 (기존 4개만 표시)
    strongGap: 0.20,          // 강한 우위 (기존 3개 + 신규 1개) ⭐ 낮춤: 0.30 → 0.20
    moderateGap: 0.10,        // 중간 (기존 2개 + 신규 2개) ⭐ 낮춤: 0.15 → 0.10
    // weakGap: < 0.10       // 약함 (기존 1위 + 신규 3개) - 드물게 발생
    
    // 신규품목 점수 비율
    newItemScoreRatio: {
      veryGood: 1.2,          // 신규 > 기존 * 1.2 (신규가 훨씬 좋음)
      good: 0.7,              // 신규 > 기존 * 0.7 (신규 포함 가치 있음)
      poor: 0.5,              // 신규 < 기존 * 0.5 (신규 별로)
    }
  },

  // UI 표시
  ui: {
    topN: 5,                  // resolveItems에서 반환할 후보 수
  }
} as const;

/**
 * 후보 조합 타입
 */
export type SuggestionComposition = {
  type: 'existing_only' | 'new_dominant' | 'existing_strong' | 'balanced' | 'existing_preferred';
  existing: number;
  newItems: number;
  reason: string;
};

/**
 * 후보 조합 결정 함수
 * 
 * GAP과 신규품목 점수를 기반으로 최적의 후보 조합을 결정합니다.
 * 
 * @param existingCandidates - 기존 품목 후보 목록 (점수 순 정렬)
 * @param newItemCandidates - 신규 품목 후보 목록 (점수 순 정렬)
 * @param config - 설정 (기본값: ITEM_MATCH_CONFIG.suggestions)
 * @returns 후보 조합 정보
 */
export function decideSuggestionComposition(
  existingCandidates: Array<{ score: number; [key: string]: any }>,
  newItemCandidates: Array<{ score: number; [key: string]: any }>,
  config = ITEM_MATCH_CONFIG.suggestions
): SuggestionComposition {
  const bestScore = existingCandidates[0]?.score ?? 0;
  const secondScore = existingCandidates[1]?.score ?? 0;
  const gap = bestScore - secondScore;
  const newItemBestScore = newItemCandidates[0]?.score ?? 0;

  // 케이스 1: 압도적 우위 (GAP >= 0.50) & 신규품목 별로
  // 예: 1위 1.263, 2위 0.275 (gap 0.988), 신규 0.275
  if (gap >= config.dominantGap && newItemBestScore < bestScore * config.newItemScoreRatio.poor) {
    return {
      type: 'existing_only',
      existing: 8,  // ⭐ 4 → 8
      newItems: 0,
      reason: `기존 1위가 압도적 (gap=${gap.toFixed(3)}, 신규=${newItemBestScore.toFixed(3)})`
    };
  }

  // 케이스 2: 신규품목이 훨씬 좋음
  // 예: 1위 0.550, 신규 0.700
  if (newItemBestScore > bestScore * config.newItemScoreRatio.veryGood) {
    return {
      type: 'new_dominant',
      existing: 2,  // ⭐ 1 → 2
      newItems: 6,  // ⭐ 3 → 6
      reason: `신규품목이 더 유망함 (기존=${bestScore.toFixed(3)}, 신규=${newItemBestScore.toFixed(3)})`
    };
  }

  // 케이스 3: 강한 우위 (GAP >= 0.30)
  // 예: 1위 0.750, 2위 0.400 (gap 0.350)
  if (gap >= config.strongGap) {
    return {
      type: 'existing_strong',
      existing: 5,  // ⭐ 3 → 5
      newItems: 3,  // ⭐ 1 → 3
      reason: `기존 1위가 우세 (gap=${gap.toFixed(3)})`
    };
  }

  // 케이스 4: 중간 (GAP >= 0.15)
  // 예: 1위 0.650, 2위 0.480 (gap 0.170)
  if (gap >= config.moderateGap) {
    return {
      type: 'balanced',
      existing: 4,  // ⭐ 2 → 4
      newItems: 4,  // ⭐ 2 → 4
      reason: `기존/신규 균형 (gap=${gap.toFixed(3)})`
    };
  }

  // 케이스 5: 기본값 (GAP < 0.10) - 기존 + 신규 균형 표시 ⭐
  // 예: 1위 0.350, 2위 0.320 (gap 0.030)
  // ✅ 총 8개: 기존 품목 많이 + 신규 품목도 충분히
  return {
    type: 'existing_preferred',
    existing: 5,  // ⭐ 3 → 5 (기존 품목 더 많이)
    newItems: 3,  // ⭐ 1 → 3 (신규 품목도 충분히)
    reason: `기존 입고품목 우선 (gap=${gap.toFixed(3)}, 거래처 이력 반영)`
  };
}
