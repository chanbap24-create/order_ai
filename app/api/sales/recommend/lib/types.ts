export interface ScoredItem {
  item_no: string;
  item_name: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  price: number;
  stock: number;
  score: number;
  tags: string[];
  reason: string;
  buy_count?: number;
  last_order?: string;
}

export interface ClientPreferences {
  countryBuyCount: Record<string, number>;
  grapeBuyCount: Record<string, number>;
  typeBuyCount: Record<string, number>;
  subRegionBuyCount: Record<string, number>;
  majorRegionBuyCount: Record<string, number>;
  superRegionBuyCount: Record<string, number>;
  totalPurchases: number;
  clientAvgPrice: number;
  topCountries: [string, number][];
  topGrapes: [string, number][];
  topTypes: [string, number][];
  maxCountryBuy: number;
  maxGrapeBuy: number;
  maxTypeBuy: number;
  maxSubRegionBuy: number;
  maxMajorRegionBuy: number;
  maxSuperRegionBuy: number;
  hasRegionPrefs: boolean;
  hasHistory: boolean;
}

export interface PurchaseAggEntry {
  count: number;
  lastDate: string;
  totalPrice: number;
  name: string;
}
