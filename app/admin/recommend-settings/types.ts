export interface WeightConfig {
  REORDER: number;
  COUNTRY_MATCH: number;
  GRAPE_MATCH: number;
  TYPE_MATCH: number;
  PRICE_FIT: number;
  SALES_VELOCITY: number;
  SEASONAL: number;
  UPSELL: number;
}

export interface StockRuleConfig {
  price_300k: number;
  price_200k: number;
  price_100k: number;
  price_50k: number;
  price_20k: number;
  price_under_20k: number;
  months_supply: number;
}

export interface Defaults {
  weights: WeightConfig;
  stockRules: StockRuleConfig;
}
