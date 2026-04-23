// 조합 가중치 시스템 (Weighted Scoring Engine) - 배럴
// 실제 구현은 weighted-scoring/ 하위 모듈에 분산.

export {
  SIGNAL_WEIGHTS,
  LEARNING_BONUS,
  RECENT_PURCHASE_BONUS,
  FREQUENCY_BONUS,
  TOKEN_MATCH_BONUS,
  ALIAS_MATCH_BONUS,
} from "./weighted-scoring/constants";

export type {
  LearningSignal,
  RecentPurchaseSignal,
  FrequencySignal,
  TokenMatchSignal,
  AliasMatchSignal,
  VintageSignal,
  WeightedScore,
  PreloadedScoringData,
} from "./weighted-scoring/types";

export { getVintageSignal } from "./weighted-scoring/vintageSignal";
export {
  getUserLearningSignal,
  getRecentPurchaseSignal,
  getPurchaseFrequencySignal,
} from "./weighted-scoring/dbSignals";
export { preloadScoringData } from "./weighted-scoring/cachedSignals";
export {
  calculateWeightedScore,
  calculateWeightedScoreCached,
} from "./weighted-scoring/calculateScore";
