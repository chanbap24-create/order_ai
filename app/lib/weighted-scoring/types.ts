export interface LearningSignal {
  score: number;
  count: number;
  kind: "exact" | "contains_specific" | "contains_weak" | null;
}

export interface RecentPurchaseSignal {
  score: number;
  lastPurchaseDaysAgo: number | null;
}

export interface FrequencySignal {
  score: number;
  purchaseCount: number;
}

export interface TokenMatchSignal {
  score: number;
  matchedTokens: string[];
  learnedCount: number;
}

export interface AliasMatchSignal {
  score: number;
  matchedAlias: string | null;
  useCount: number;
}

export interface VintageSignal {
  score: number;
  itemVintage: number | null;
}

export interface WeightedScore {
  finalScore: number;
  signals: {
    baseScore: number;
    userLearning: LearningSignal;
    tokenMatch: TokenMatchSignal;
    aliasMatch: AliasMatchSignal;
    recentPurchase: RecentPurchaseSignal;
    purchaseFrequency: FrequencySignal;
    vintage: VintageSignal;
    supply_price?: number;
  };
  weights: {
    baseScore: number;
    userLearning: number;
    tokenMatch: number;
    aliasMatch: number;
    recentPurchase: number;
    purchaseFrequency: number;
    vintage: number;
  };
  rawTotal: number;
}

export interface PreloadedScoringData {
  itemAliases: Array<{ alias: string; canonical: string; count: number; client_code: string | null }>;
  clientStats: Map<string, { updated_at: string | null; supply_price: number | null }>;
  tokenMappings: Array<{ token: string; mapped_text: string; learned_count: number }>;
  supplyPrices: Map<string, number>;
}
