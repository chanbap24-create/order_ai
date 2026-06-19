// 추천견적 조절 설정 — 영업사원별(브라우저) 저장. 어드민 아님.
export type GeoCeiling = 'super' | 'country' | 'any';
export type FreqStrength = 'strong' | 'soft' | 'off';

/** 점수 가중치(화면 조절). 서버 scoring.ts ScoreParams 와 동일 형태. */
export interface ScoreParams {
  tierBase: [number, number, number, number]; // 같은마을/인근마을/같은광역/타지역
  reorderScore: number;   // 재주문 고정 점수
  softWeight: number;     // 품종·향미 가산 배수
  velocityWeight: number; // 회전 가산 배수
  recentPenalty: number;  // 최근제안 강등 배율
  convBoost: number;      // 전환 1회당 가점
  noconvPenalty: number;  // 미전환 감점 배율
}
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  tierBase: [92, 74, 58, 42], reorderScore: 100,
  softWeight: 8, velocityWeight: 2, recentPenalty: 0.45, convBoost: 8, noconvPenalty: 0.6,
};

export interface RecSettings {
  periodMonths: number; // 분석 기간(개월)
  priceBand: number;    // 가격 밴드 ±%
  minScore: number;     // 추천 점수 허들(클라이언트 즉시 필터)
  geoCeiling: GeoCeiling;     // 지역 확장 범위
  freqStrength: FreqStrength; // 입고빈도 반영 강도
  stockMonths: number;  // 재고 여유분(개월)
  minStock: { price_300k: number; price_200k: number; price_100k: number; price_50k: number; price_20k: number; price_under_20k: number };
  scoreParams: ScoreParams; // 점수 가중치
}

export const DEFAULT_REC_SETTINGS: RecSettings = {
  periodMonths: 6, priceBand: 20, minScore: 0,
  geoCeiling: 'super', freqStrength: 'strong', stockMonths: 1,
  minStock: { price_300k: 6, price_200k: 12, price_100k: 60, price_50k: 120, price_20k: 180, price_under_20k: 300 },
  scoreParams: DEFAULT_SCORE_PARAMS,
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
        scoreParams: {
          ...DEFAULT_SCORE_PARAMS, ...(p.scoreParams || {}),
          tierBase: Array.isArray(p.scoreParams?.tierBase) && p.scoreParams.tierBase.length === 4
            ? p.scoreParams.tierBase : DEFAULT_SCORE_PARAMS.tierBase,
        },
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_REC_SETTINGS };
}

export function saveRecSettings(s: RecSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
