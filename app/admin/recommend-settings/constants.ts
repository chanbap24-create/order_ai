import type { StockRuleConfig, WeightConfig } from './types';

export const WEIGHT_LABELS: Record<keyof WeightConfig, { label: string; desc: string; color: string }> = {
  REORDER: { label: '재주문', desc: '과거 2회+ 구매 후 3개월 미발주 와인', color: '#2196F3' },
  REGION_MATCH: { label: '선호 산지', desc: '거래처 구매 산지(빌리지·밭) 계층 매칭 — 지역 기반 추천', color: '#7C3AED' },
  COUNTRY_MATCH: { label: '선호 국가', desc: '산지 매칭 실패 시 국가 단위 fallback', color: '#9C27B0' },
  GRAPE_MATCH: { label: '선호 품종', desc: '거래처가 자주 구매하는 품종의 와인', color: '#E91E63' },
  TYPE_MATCH: { label: '선호 타입', desc: '거래처가 선호하는 와인 타입 (레드/화이트/스파클링 등)', color: '#00897B' },
  PRICE_FIT: { label: '가격 적합도', desc: '거래처 평균 구매가 ±20% 이내', color: '#4CAF50' },
  SALES_VELOCITY: { label: '판매 인기도', desc: '전체 판매량 기준 인기 와인', color: '#FF5722' },
  SEASONAL: { label: '시즌 매치', desc: '현재 계절에 어울리는 와인 타입/품종', color: '#5C6BC0' },
  UPSELL: { label: '프리미엄', desc: '평균 구매가 대비 20~50% 높은 업셀링', color: '#FF9800' },
};

export const STOCK_LABELS: Record<keyof StockRuleConfig, { label: string; unit: string }> = {
  price_300k: { label: '30만원 이상', unit: '병' },
  price_200k: { label: '20만원 이상', unit: '병' },
  price_100k: { label: '10만원 이상', unit: '병' },
  price_50k: { label: '5만원 이상', unit: '병' },
  price_20k: { label: '2만원 이상', unit: '병' },
  price_under_20k: { label: '2만원 미만', unit: '병' },
  months_supply: { label: '최소 여유분', unit: '개월' },
};
