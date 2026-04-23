/* 신호별 중요도 (multiplier) */
export const SIGNAL_WEIGHTS = {
  BASE_SCORE: 1.0,         // 기본 문자열 유사도 (0~1 범위 유지)
  USER_LEARNING: 0.30,     // 사용자 학습 보너스
  TOKEN_MATCH: 0.25,       // 토큰 매칭
  ALIAS_MATCH: 0.20,       // 별칭 매칭
  RECENT_PURCHASE: 0.15,   // 최근 구매 이력
  PURCHASE_FREQUENCY: 0.10, // 구매 빈도
  VINTAGE: 0.05,           // 빈티지
};

export const LEARNING_BONUS = {
  1: 0.20,
  2: 0.30,
  3: 0.40,
};

export const RECENT_PURCHASE_BONUS = {
  WITHIN_7_DAYS: 0.20,
  WITHIN_30_DAYS: 0.15,
  WITHIN_90_DAYS: 0.10,
  OLDER: 0.05,
};

export const FREQUENCY_BONUS = {
  VERY_HIGH: 0.15,
  HIGH: 0.10,
  MEDIUM: 0.05,
  LOW: 0.02,
};

export const TOKEN_MATCH_BONUS = {
  BASE: 0.20,
  HIGH_FREQUENCY: 0.10,
  MEDIUM_FREQUENCY: 0.05,
  LOW_FREQUENCY: 0.02,
};

export const ALIAS_MATCH_BONUS = {
  BASE: 0.15,
  HIGH_USE: 0.10,
  MEDIUM_USE: 0.05,
  LOW_USE: 0.02,
};
