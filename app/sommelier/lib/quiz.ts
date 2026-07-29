// 백화점 손님 취향 문답 정의 — 질문·선택지·향미 그룹 매핑 (클라이언트/서버 공용 상수)

export type QuizAnswers = {
  type: 'red' | 'white' | 'sparkling' | 'sweet' | 'rose' | null; // null = 상관없음. sweet=당도 기반
  body: 'light' | 'medium' | 'full' | null;
  flavorGroups: string[]; // FLAVOR_GROUPS 키 (멀티, 구버전 호환)
  flavors: string[];      // 세부 향미 키(52키 어휘) — 드릴다운에서 개별 선택
  countries: string[];    // COUNTRY_OPTIONS 키 (멀티, 빈 배열 = 상관없음)
  priceMin: number | null;
  priceMax: number | null;
};

export const EMPTY_ANSWERS: QuizAnswers = {
  type: null, body: null, flavorGroups: [], flavors: [], countries: [], priceMin: null, priceMax: null,
};

/** 향미 취향 그룹 → 정규 향미 키(app/api/sales/recommend/lib/flavor.ts 어휘) */
export const FLAVOR_GROUPS: Record<string, { label: string; desc: string; keys: string[] }> = {
  fresh_fruit: {
    label: '상큼한 과일', desc: '레몬·청사과·자몽',
    keys: ['lemon', 'lime', 'grapefruit', 'green_apple', 'apple', 'pear', 'quince', 'melon'],
  },
  sweet_fruit: {
    label: '달콤한 과일', desc: '복숭아·망고·꿀',
    keys: ['peach', 'apricot', 'pineapple', 'mango', 'passionfruit', 'lychee', 'honey'],
  },
  red_fruit: {
    label: '붉은 과일', desc: '체리·딸기·라즈베리',
    keys: ['cherry', 'strawberry', 'raspberry', 'redcurrant'],
  },
  black_fruit: {
    label: '진한 검은 과일', desc: '블랙베리·카시스·자두',
    keys: ['blackberry', 'blackcurrant', 'plum', 'blueberry', 'dried_fruit'],
  },
  floral_herb: {
    label: '꽃·허브', desc: '장미·제비꽃·민트',
    keys: ['violet', 'rose', 'floral_white', 'elderflower', 'mint', 'eucalyptus', 'herb_green', 'grassy'],
  },
  oak_spice: {
    label: '오크·스파이스', desc: '바닐라·커피·후추',
    keys: ['vanilla', 'toast', 'cedar', 'coffee_choc', 'coconut', 'black_pepper', 'sweet_spice', 'licorice'],
  },
  earthy: {
    label: '숙성·흙내음', desc: '버섯·가죽·담배',
    keys: ['mushroom', 'forest_floor', 'leather_tobacco', 'game_meat', 'tar'],
  },
  mineral: {
    label: '미네랄', desc: '부싯돌·젖은돌·짠기',
    keys: ['flint', 'wet_stone', 'chalk', 'saline', 'petrol'],
  },
  creamy: {
    label: '버터·크림·빵', desc: '버터·브리오슈·견과',
    keys: ['butter', 'cream', 'brioche_yeast', 'nutty'],
  },
};

export const TYPE_OPTIONS = [
  { value: 'red' as const, label: 'Red', desc: '' },
  { value: 'white' as const, label: 'White', desc: '' },
  { value: 'sparkling' as const, label: 'Sparkling', desc: '' },
  { value: 'sweet' as const, label: 'Sweet', desc: '' },
  { value: null, label: '상관없어요', desc: '' },
];

/** 백화점 매장 — inventory_cdv 매장 재고 컬럼 키 ↔ 표시명 */
export const STORES: Record<string, string> = {
  all: '전체 매장',
  store_hyundai_trade: '현대백화점 무역센터점',
  store_hyundai_main: '현대백화점 압구정본점',
  store_hyundai_jungdong: '현대백화점 중동점',
  store_ssg_gangnam: '신세계백화점 강남점',
  store_thehyundai: '더현대 서울',
};

export const BODY_OPTIONS = [
  { value: 'light' as const, label: 'Light', desc: '' },
  { value: 'medium' as const, label: 'Medium', desc: '' },
  { value: 'full' as const, label: 'Full', desc: '' },
  { value: null, label: '상관없어요', desc: '' },
];

/** 선호 국가 그룹 — wines.country 문자열 매칭 (멀티 선택) */
export const COUNTRY_OPTIONS: Record<string, { label: string; desc: string; match: string[] }> = {
  france: { label: '프랑스', desc: '부르고뉴·보르도·샴페인', match: ['프랑스', 'france'] },
  italy: { label: '이탈리아', desc: '토스카나·피에몬테', match: ['이탈리아', 'italy'] },
  usa: { label: '미국', desc: '나파·소노마·오리건', match: ['미국', 'united states', 'usa'] },
  iberia: { label: '스페인·포르투갈', desc: '리오하·프리오랏·도루', match: ['스페인', '포르투갈', 'spain', 'portugal'] },
  southam: { label: '칠레·아르헨티나', desc: '남미의 진한 과실미', match: ['칠레', '아르헨티나', 'chile', 'argentina'] },
  oceania: { label: '호주·뉴질랜드', desc: '신세계의 깨끗한 스타일', match: ['호주', '뉴질랜드', 'australia', 'new zealand'] },
};

export const PRICE_OPTIONS = [
  { min: null, max: 30000, label: '3만원 이하' },
  { min: 30000, max: 50000, label: '3~5만원' },
  { min: 50000, max: 100000, label: '5~10만원' },
  { min: 100000, max: 200000, label: '10~20만원' },
  { min: 200000, max: null, label: '20만원 이상' },
  { min: null, max: null, label: '상관없어요' },
];

/** wine_type(한/영 혼재) → 정규 타입 */
export function normalizeWineType(t: string): 'red' | 'white' | 'sparkling' | 'rose' | 'fortified' | '' {
  const s = (t || '').toLowerCase().trim();
  if (!s) return '';
  if (s.includes('레드') || s.includes('red')) return 'red';
  if (s.includes('화이트') || s.includes('white')) return 'white';
  if (s.includes('스파클링') || s.includes('sparkling') || s.includes('샴페인') || s.includes('champagne')) return 'sparkling';
  if (s.includes('로제') || s.includes('rose') || s.includes('rosé')) return 'rose';
  if (s.includes('주정강화') || s.includes('fortified') || s.includes('디저트') || s.includes('dessert')) return 'fortified';
  return '';
}

/** 핸드폰 번호 정규화 — 숫자만 (01012345678). 10~11자리 아니면 null */
export function normalizePhone(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '');
  return /^01\d{8,9}$/.test(d) ? d : null;
}
