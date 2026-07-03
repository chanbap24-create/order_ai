// 거래처 업장 유형(요리/성격) → 선호 와인 프로필. 특정 와인을 콕 집지 않고
// '타입·나라·지역' 3축으로 나눠 가산(각 축 독립). 20점 배분 = 타입 8 + 나라 8 + 지역 4.
// (타입+국가가 적합의 핵심, 정확한 지역은 얹는 보너스 → 지역 비중을 가장 낮게.)
// 나라/지역은 DB 표기(한글)에 맞춘 키워드. 27종 전부 소믈리에 관점 매핑(태깅 안 된 것도 추론).
import type { TypeBucket } from './wineType';

export interface VenueWinePref {
  types: TypeBucket[];      // 딱 맞는 타입(풀 가산)
  okTypes?: TypeBucket[];   // 무난한 타입(절반)
  countries?: string[];     // 선호 나라(한글 부분일치)
  regions?: string[];       // 선호 지역/광역(한글 부분일치)
  exclude?: TypeBucket[];   // 안 맞는 타입 → 업장 가산 0
}

// 20점 배분 비율(타입 0.4 · 나라 0.4 · 지역 0.2). venueWeight 에 곱해 적용.
// 타입·국가가 적합의 핵심(각 8), 정확한 지역은 얹는 보너스(4).
const W_TYPE = 0.4, W_COUNTRY = 0.4, W_REGION = 0.2;

// 키는 venueTypes.ts VENUE_MAP 과 동일. 포트폴리오상 독일·오스트리아(리슬링) 비중이 커 화이트/아로마틱 업장에 반영.
export const VENUE_WINE_MAP: Record<string, VenueWinePref> = {
  // 일식
  sushi:       { types: ['sparkling', 'white'], countries: ['프랑스', '독일', '오스트리아'], regions: ['샹파뉴', '샴페인', '부르고뉴', '샤블리', '모젤', '루아르'], exclude: ['fortified'] },
  washoku:     { types: ['white', 'sparkling'], okTypes: ['red'], countries: ['프랑스', '독일', '오스트리아'], regions: ['부르고뉴', '샹파뉴', '알자스'], exclude: ['fortified'] },
  izakaya:     { types: ['sparkling', 'white'], okTypes: ['red'], countries: ['프랑스', '독일'], regions: ['샹파뉴', '샴페인', '부르고뉴'] },
  yakitori:    { types: ['sparkling'], okTypes: ['red'], countries: ['프랑스'], regions: ['보졸레', '부르고뉴'] },
  unagi:       { types: ['white'], okTypes: ['red'], countries: ['프랑스', '독일'], regions: ['알자스', '모젤'] },
  ramen:       { types: ['sparkling', 'white'], countries: [], regions: [] },
  // 양식
  steak:       { types: ['red'], okTypes: ['sparkling'], countries: ['프랑스', '미국', '아르헨티나', '칠레', '호주', '스페인'], regions: ['보르도', '론'] },
  french:      { types: ['red', 'white'], okTypes: ['sparkling'], countries: ['프랑스'], regions: ['부르고뉴', '보르도', '샹파뉴', '론', '루아르', '알자스'] },
  italian:     { types: ['red', 'white'], countries: ['이탈리아'], regions: ['토스카나', '피에몬테', '베네토', '시칠리아'] },
  spanish:     { types: ['red', 'sparkling'], countries: ['스페인'], regions: ['리오하', '리베라', '프리오라트'] },
  bistro:      { types: ['red', 'white'], countries: ['프랑스', '이탈리아'], regions: [] },
  seafood_w:   { types: ['white', 'sparkling'], countries: ['프랑스', '독일', '오스트리아'], regions: ['샤블리', '샹파뉴', '루아르', '모젤'], exclude: ['fortified'] },
  // 한식
  kbbq:        { types: ['red'], okTypes: ['sparkling'], countries: ['칠레', '아르헨티나', '미국', '호주', '프랑스'], regions: [] },
  hanjeongsik: { types: ['white', 'red'], okTypes: ['sparkling'], countries: [], regions: [] },
  hoetjip:     { types: ['white', 'sparkling'], countries: ['프랑스', '독일', '오스트리아'], regions: ['샤블리', '샹파뉴', '모젤'], exclude: ['fortified'] },
  jjim:        { types: ['white'], okTypes: ['red'], countries: ['독일', '오스트리아'], regions: [] },
  kfusion:     { types: ['sparkling', 'white', 'red', 'rose'], countries: [], regions: [], exclude: ['fortified'] },
  // 중식
  cantonese:   { types: ['white', 'sparkling'], countries: ['프랑스', '독일', '오스트리아'], regions: ['알자스', '샹파뉴', '모젤'] },
  sichuan:     { types: ['white', 'rose'], okTypes: ['sparkling'], countries: ['독일', '오스트리아', '프랑스'], regions: ['알자스', '모젤'] },
  chinese_gen: { types: ['white', 'red'], countries: [], regions: [] },
  // 기타
  fusion:      { types: ['sparkling', 'white', 'red', 'rose'], countries: [], regions: [], exclude: ['fortified'] },
  winebar:     { types: ['red', 'white', 'sparkling', 'rose'], countries: ['프랑스', '이탈리아', '독일', '오스트리아'], regions: [] },
  hotel:       { types: ['sparkling', 'white', 'red'], okTypes: ['rose', 'fortified'], countries: ['프랑스'], regions: ['샹파뉴', '부르고뉴', '보르도'] },
  bar:         { types: ['sparkling'], okTypes: ['white', 'red'], countries: [], regions: [] },
  cafe:        { types: ['sparkling'], okTypes: ['white'], countries: ['이탈리아'], regions: ['아스티', '모스카토'] },
  retail:      { types: ['sparkling', 'white', 'red', 'rose'], countries: [], regions: [] },
  // 도매장(재판매): 취향보다 인기·가성비가 핵심 → 타입 전방위, 나라/지역 무관. 인기 블렌드가 실질 개인화.
  wholesale:   { types: ['sparkling', 'white', 'red', 'rose'], okTypes: ['fortified'], countries: [], regions: [] },
};

export interface VenueScore { total: number; type: number; country: number; region: number }

/**
 * 후보 1건의 업장 가산 — 타입·나라·지역 3축 독립. 각 축이 맞으면 그 축 배점만큼.
 *   타입: 딱맞음 1 · 무난 0.5 · 아니면 0 (제외 타입이면 전체 0)
 *   나라/지역: 키워드 하나라도 맞으면 1, 아니면 0
 */
export function scoreVenue(
  pref: VenueWinePref | null | undefined,
  cand: { bucket: string; country: string; regionText: string },
  weight: number,
): VenueScore {
  const zero: VenueScore = { total: 0, type: 0, country: 0, region: 0 };
  if (!pref || weight <= 0 || !cand.bucket) return zero;
  const bucket = cand.bucket as TypeBucket;
  if (pref.exclude?.includes(bucket)) return zero;

  const primary = pref.types.includes(bucket);
  const typeFit = primary ? 1 : (pref.okTypes?.includes(bucket) ? 0.5 : 0);
  const ct = (cand.country || '').toLowerCase();
  const rt = (cand.regionText || '').toLowerCase();
  const countryFit = (pref.countries || []).some((k) => ct.includes(k.toLowerCase())) ? 1 : 0;
  const regionFit = (pref.regions || []).some((k) => rt.includes(k.toLowerCase())) ? 1 : 0;

  const type = Math.round(weight * W_TYPE * typeFit * 10) / 10;
  const country = Math.round(weight * W_COUNTRY * countryFit * 10) / 10;
  const region = Math.round(weight * W_REGION * regionFit * 10) / 10;
  return { total: Math.round((type + country + region) * 10) / 10, type, country, region };
}
