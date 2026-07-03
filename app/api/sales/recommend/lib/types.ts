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
  breakdown?: string[]; // 점수 분해(표시용)
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
  priceStats: Record<string, { median: number; n: number }>; // 횟수 가중 중앙값(초고가 제외). "bucket|group"/"bucket"/"__all__"
  premiumBand: number;                 // 초고가(주력 중앙값의 K배 초과) 구매의 중앙값. 없으면 0.
  flavorKeys: Set<string>;             // 거래처 향미 키
  grapeKeys: Set<string>;              // 거래처 품종(소문자)
  regionDist: Record<string, number>;  // 지역(광역/대지역/국가)별 매입 횟수 분포
}

export interface PurchaseAggEntry {
  count: number;       // 구매 발생 횟수(출고 행 수) — 재주문 판정·표시용
  pricedCount: number; // 0원(시음주 등) 제외 유상 출고 행 수 — 가격 평균/밴드 분모·가중치
  qty: number;         // 누적 병수
  spend: number;       // 누적 매입액(병수×단가) — 선호도 가중치 기준
  lastDate: string;
  totalPrice: number;
  name: string;
}
