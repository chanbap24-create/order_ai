import { SIGNAL_WEIGHTS } from "./constants";
import { getVintageSignal } from "./vintageSignal";
import {
  getUserLearningSignal, getRecentPurchaseSignal, getPurchaseFrequencySignal,
  getTokenMatchSignal, getAliasMatchSignal,
} from "./dbSignals";
import {
  getUserLearningSignalCached, getRecentPurchaseSignalCached,
  getPurchaseFrequencySignalCached, getTokenMatchSignalCached,
  getAliasMatchSignalCached,
} from "./cachedSignals";
import type { WeightedScore, PreloadedScoringData } from "./types";

export async function calculateWeightedScore(
  rawInput: string,
  clientCode: string,
  itemNo: string,
  baseScore: number,
  dataType: 'wine' | 'glass' = 'wine',
  supplyPrice?: number,
): Promise<WeightedScore> {
  const [userLearning, recentPurchase, purchaseFrequency, tokenMatch, aliasMatch] = await Promise.all([
    getUserLearningSignal(rawInput, itemNo, clientCode),
    getRecentPurchaseSignal(clientCode, itemNo, dataType),
    getPurchaseFrequencySignal(clientCode, itemNo, dataType),
    getTokenMatchSignal(rawInput, itemNo),
    getAliasMatchSignal(rawInput, itemNo),
  ]);
  const vintage = dataType === 'wine'
    ? getVintageSignal(rawInput, itemNo)
    : { score: 0, itemVintage: null };

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
    weights.baseScore +
    weights.userLearning +
    weights.tokenMatch +
    weights.aliasMatch +
    weights.recentPurchase +
    weights.purchaseFrequency +
    weights.vintage;

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
  };
}

export function calculateWeightedScoreCached(
  rawInput: string,
  clientCode: string,
  itemNo: string,
  baseScore: number,
  preloaded: PreloadedScoringData,
  dataType: 'wine' | 'glass' = 'wine',
  supplyPrice?: number,
): WeightedScore {
  const userLearning = getUserLearningSignalCached(rawInput, itemNo, clientCode, preloaded.itemAliases);
  const recentPurchase = getRecentPurchaseSignalCached(itemNo, preloaded.clientStats);
  const purchaseFrequency = getPurchaseFrequencySignalCached(itemNo, preloaded.clientStats);
  const tokenMatch = getTokenMatchSignalCached(rawInput, itemNo, preloaded.tokenMappings);
  const aliasMatch = getAliasMatchSignalCached(rawInput, itemNo, preloaded.itemAliases);
  const vintage = dataType === 'wine'
    ? getVintageSignal(rawInput, itemNo)
    : { score: 0, itemVintage: null };

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
  };
}
