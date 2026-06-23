// 추천견적 조절 설정 — 영업사원별(브라우저) 저장. 어드민 아님.
export type GeoCeiling = 'super' | 'country' | 'any';
export type FreqStrength = 'strong' | 'soft' | 'off';
// 추천 타입: new=신규제안(취향 기반), substitute=대체상품(쇼트상품 근접), discovery=발굴(이력 무관·베스트셀러+업태)
export type RecMode = 'new' | 'substitute' | 'discovery';

/** 점수 가중치(화면 조절). 서버 scoring.ts ScoreParams 와 동일 형태. */
export interface ScoreParams {
  tierBase: [number, number, number, number]; // 같은마을/인근마을/같은광역/타지역
  reorderBonus: number;   // 재주문(검증된 구매) 보너스 — 구매강도·지연 차등
  softWeight: number;     // 품종·향미 가산 배수
  velocityWeight: number; // 회전 가산 배수
  recentPenalty: number;  // 최근제안 강등 배율
  convBoost: number;      // 전환 1회당 가점
  noconvPenalty: number;  // 미전환 감점 배율
  quoteFeedbackWeight: number; // 견적학습(속성 단위 전환) ±가중치
}
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  tierBase: [46, 37, 29, 21], reorderBonus: 30,
  softWeight: 8, velocityWeight: 2, recentPenalty: 0.45, convBoost: 8, noconvPenalty: 0.6,
  quoteFeedbackWeight: 44, // 지역46+학습44+취향8+회전2 = 100점 만점
};

export interface RecSettings {
  mode: RecMode;        // 추천 타입(신규제안/대체상품/발굴)
  discoveryTypes: string[];   // 발굴: 와인타입 버킷(비면 전체)
  discoveryMinPrice: number;  // 발굴: 최소 공급가(0=무제한)
  discoveryMaxPrice: number;  // 발굴: 최대 공급가(0=무제한)
  discoverySegment: string;   // 발굴: 업태(''=거래처 업태 자동)
  includeNonStandard: boolean; // 375ml·1.5L+ 포함(기본 false=750ml만)
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
  mode: 'new',
  discoveryTypes: [], discoveryMinPrice: 0, discoveryMaxPrice: 0, discoverySegment: '',
  includeNonStandard: false,
  periodMonths: 6, priceBand: 20, minScore: 0,
  geoCeiling: 'super', freqStrength: 'strong', stockMonths: 1,
  minStock: { price_300k: 6, price_200k: 12, price_100k: 60, price_50k: 120, price_20k: 180, price_under_20k: 300 },
  scoreParams: DEFAULT_SCORE_PARAMS,
};

// 가중치 스킴이 바뀌면 키를 올린다(옛 저장값을 통째로 버려 새 기본값을 강제 적용).
const KEY = 'recQuote.settings.v2';
const SETTINGS_VERSION = 2;

export function loadRecSettings(): RecSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_REC_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      // 버전 불일치 = 가중치 스킴 변경 → 저장된 점수 가중치 무시하고 새 기본값 사용
      const freshScore = p.version !== SETTINGS_VERSION;
      return {
        ...DEFAULT_REC_SETTINGS, ...p,
        minStock: { ...DEFAULT_REC_SETTINGS.minStock, ...(p.minStock || {}) },
        scoreParams: freshScore ? { ...DEFAULT_SCORE_PARAMS } : {
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
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, version: SETTINGS_VERSION })); } catch { /* ignore */ }
}
