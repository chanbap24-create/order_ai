// 추천견적 조절 설정 — 영업사원별(브라우저) 저장. 어드민 아님.
export type GeoCeiling = 'super' | 'country' | 'any';
export type FreqStrength = 'strong' | 'soft' | 'off';

export interface RecSettings {
  periodMonths: number; // 분석 기간(개월)
  priceBand: number;    // 가격 밴드 ±%
  minScore: number;     // 추천 점수 허들(클라이언트 즉시 필터)
  geoCeiling: GeoCeiling;     // 지역 확장 범위
  freqStrength: FreqStrength; // 입고빈도 반영 강도
  stockMonths: number;  // 재고 여유분(개월)
  minStock: { price_300k: number; price_200k: number; price_100k: number; price_50k: number; price_20k: number; price_under_20k: number };
}

export const DEFAULT_REC_SETTINGS: RecSettings = {
  periodMonths: 6, priceBand: 20, minScore: 0,
  geoCeiling: 'super', freqStrength: 'strong', stockMonths: 1,
  minStock: { price_300k: 6, price_200k: 12, price_100k: 60, price_50k: 120, price_20k: 180, price_under_20k: 300 },
};

const KEY = 'recQuote.settings';

export function loadRecSettings(): RecSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_REC_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        ...DEFAULT_REC_SETTINGS, ...p,
        minStock: { ...DEFAULT_REC_SETTINGS.minStock, ...(p.minStock || {}) },
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_REC_SETTINGS };
}

export function saveRecSettings(s: RecSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
