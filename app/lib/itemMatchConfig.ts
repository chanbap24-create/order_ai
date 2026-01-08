/**
 * 품목 매칭 규칙 중앙 관리
 * 
 * 모든 임계값과 규칙을 한 곳에서 관리하여 일관성을 유지합니다.
 */

export const ITEM_MATCH_CONFIG = {
  // 자동 확정 임계값
  autoResolve: {
    minScore: 0.70,           // 최소 점수 (0.70 이상이면 자동 확정 가능)
    minGap: 0.30,             // 최소 점수 차이 (1위와 2위 gap >= 0.30)
    highConfidenceScore: 0.95, // 고신뢰 점수 (0.95 이상이면 gap 0.20만 있어도 확정)
    highConfidenceGap: 0.20,   // 고신뢰 점수 차이
  },

  // 신규품목 검색
  newItemSearch: {
    threshold: 0.70,          // 신규품목 검색 시작 점수 (bestScore < 0.70일 때만)
    maxCandidates: 5,         // 최대 신규품목 후보 수
  },

  // 후보 표시 규칙
  suggestions: {
    total: 4,                 // 총 후보 개수
    
    // GAP 기반 규칙
    dominantGap: 0.50,        // 압도적 우위 (기존 4개만 표시)
    strongGap: 0.30,          // 강한 우위 (기존 3개 + 신규 1개)
    moderateGap: 0.15,        // 중간 (기존 2개 + 신규 2개)
    // weakGap: < 0.15       // 약함 (기존 1개 + 신규 3개)
    
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
  type: 'existing_only' | 'new_dominant' | 'existing_strong' | 'balanced' | 'new_preferred';
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
      existing: 4,
      newItems: 0,
      reason: `기존 1위가 압도적 (gap=${gap.toFixed(3)}, 신규=${newItemBestScore.toFixed(3)})`
    };
  }

  // 케이스 2: 신규품목이 훨씬 좋음
  // 예: 1위 0.550, 신규 0.700
  if (newItemBestScore > bestScore * config.newItemScoreRatio.veryGood) {
    return {
      type: 'new_dominant',
      existing: 1,
      newItems: 3,
      reason: `신규품목이 더 유망함 (기존=${bestScore.toFixed(3)}, 신규=${newItemBestScore.toFixed(3)})`
    };
  }

  // 케이스 3: 강한 우위 (GAP >= 0.30)
  // 예: 1위 0.750, 2위 0.400 (gap 0.350)
  if (gap >= config.strongGap) {
    return {
      type: 'existing_strong',
      existing: 3,
      newItems: 1,
      reason: `기존 1위가 우세 (gap=${gap.toFixed(3)})`
    };
  }

  // 케이스 4: 중간 (GAP >= 0.15)
  // 예: 1위 0.650, 2위 0.480 (gap 0.170)
  if (gap >= config.moderateGap) {
    return {
      type: 'balanced',
      existing: 2,
      newItems: 2,
      reason: `기존/신규 균형 (gap=${gap.toFixed(3)})`
    };
  }

  // 케이스 5: 약함 (GAP < 0.15) - 모두 애매함
  // 예: 1위 0.350, 2위 0.320 (gap 0.030)
  return {
    type: 'new_preferred',
    existing: 1,
    newItems: 3,
    reason: `기존 품목도 불확실 (gap=${gap.toFixed(3)})`
  };
}
