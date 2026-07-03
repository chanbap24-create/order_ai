import { supabase } from '@/app/lib/db';
import { type ScoreParams, DEFAULT_SCORE_PARAMS } from './scoring';

export const DEFAULT_W = {
  REORDER: 35,
  REGION_MATCH: 22,  // 산지(빌리지/밭) 계층 매칭 — 지역 기반 우선
  COUNTRY_MATCH: 3,  // 국가 매칭 (산지 매칭 불가 시 약한 fallback)
  GRAPE_MATCH: 12,
  TYPE_MATCH: 8,
  PRICE_FIT: 10,
  SALES_VELOCITY: 5,
  SEASONAL: 7,
  UPSELL: 3,
};

export const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300,
  months_supply: 3,
};

export type Weights = typeof DEFAULT_W;
export type StockRules = typeof DEFAULT_STOCK_RULES;

// 영업사원이 추천견적 탭에서 조절하는 옵션(어드민 아님). 요청마다 전달.
export interface RecOpts {
  mode: 'new' | 'substitute' | 'discovery'; // 신규제안/대체상품/발굴(이력무관)
  anchorItemCode?: string;         // 대체상품 모드: 쇼트난 기준 상품 품번
  anchorPrice?: number;            // 대체상품 모드: 기준 상품 가격(없으면 inventory/이력에서 추정)
  discoveryTypes?: string[];       // 발굴 모드: 포함할 와인타입 버킷(비면 전체)
  discoveryMinPrice?: number;      // 발굴 모드: 최소 공급가
  discoveryMaxPrice?: number;      // 발굴 모드: 최대 공급가
  discoverySegment?: string;       // 발굴 모드: 업태(없으면 거래처 업태 자동)
  includeNonStandard?: boolean;    // true면 375ml(하프)·1.5L+(매그넘 이상)도 포함(기본 750ml만)
  discountApply?: boolean;         // 권장 할인율 적용 여부(기본 true)
  discountScope?: 'team1' | 'rest';// 권장 할인 산출 범위(영업1부/나머지, 기본 team1)
  priceBandPct: number;            // 0.2 = ±20%
  profileMonths: number;           // 분석 기간(개월)
  geoCeiling: 'super' | 'country' | 'any'; // 지역 확장 천장
  freqStrength: 'strong' | 'soft' | 'off'; // 입고빈도 반영 강도
  stockMonths: number;             // 재고 여유분(개월) — 수요충당
  minStock: { price_300k: number; price_200k: number; price_100k: number; price_50k: number; price_20k: number; price_under_20k: number }; // 가격대별 최소재고
  scoreParams: ScoreParams;        // 점수 가중치(화면 조절)
  popularityWeight?: number;       // 인기(구매폭) prior 블렌드 α(0~1, 0=미적용). 신규제안 모드만.
}
export const DEFAULT_REC_OPTS: RecOpts = {
  mode: 'new',
  priceBandPct: 0.2, profileMonths: 6, geoCeiling: 'super', freqStrength: 'strong', stockMonths: 1,
  minStock: { price_300k: 6, price_200k: 12, price_100k: 60, price_50k: 120, price_20k: 180, price_under_20k: 300 },
  scoreParams: DEFAULT_SCORE_PARAMS,
  popularityWeight: 0,
};

export async function loadSettings(): Promise<{ W: Weights; SR: StockRules }> {
  const { data: wRow } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_weights').maybeSingle();
  const { data: sRow } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle();
  const W = wRow ? { ...DEFAULT_W, ...JSON.parse(wRow.value) } : { ...DEFAULT_W };
  const SR = sRow ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(sRow.value) } : { ...DEFAULT_STOCK_RULES };
  return { W, SR };
}

export function makeMinStockForPrice(SR: RecOpts['minStock']) {
  return (price: number): number => {
    if (price >= 300000) return SR.price_300k;
    if (price >= 200000) return SR.price_200k;
    if (price >= 100000) return SR.price_100k;
    if (price >= 50000) return SR.price_50k;
    if (price >= 20000) return SR.price_20k;
    return SR.price_under_20k;
  };
}
