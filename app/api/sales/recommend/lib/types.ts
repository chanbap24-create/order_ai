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
  image_url?: string;
  brand?: string;
  vintage?: string;
}

import type { TypeBucket } from './wineType';
import type { RegionProfile } from './geoTier';

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
  // --- 규칙기반(게이트+계단) 추천용 ---
  typeBuckets: Set<TypeBucket>;        // 거래처가 사는 타입(레드/화이트/…)
  regionProfile: RegionProfile;        // 구매 지역 셋(sub/major/super)
  priceStats: Record<string, { sum: number; count: number }>; // "bucket|group" / "bucket" / "__all__"
  flavorKeys: Set<string>;             // 거래처 향미 키
  grapeKeys: Set<string>;              // 거래처 품종(소문자)
  regionDist: Record<string, number>;  // 지역(광역/대지역/국가)별 매입 횟수 분포
}

export interface PurchaseAggEntry {
  count: number;
  lastDate: string;
  totalPrice: number;
  name: string;
}
