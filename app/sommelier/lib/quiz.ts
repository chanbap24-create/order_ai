// 백화점 손님 취향 문답 정의 — 질문·선택지·향미 그룹 매핑 (클라이언트/서버 공용 상수)

export type QuizAnswers = {
  type: 'red' | 'white' | 'sparkling' | 'rose' | null; // null = 상관없음
  body: 'light' | 'medium' | 'full' | null;
  flavorGroups: string[]; // FLAVOR_GROUPS 키 (멀티)
  priceMin: number | null;
  priceMax: number | null;
  occasion: 'gift' | 'meal' | 'casual' | 'special' | null;
};

export const EMPTY_ANSWERS: QuizAnswers = {
  type: null, body: null, flavorGroups: [], priceMin: null, priceMax: null, occasion: null,
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
  { value: 'red' as const, label: '레드' },
  { value: 'white' as const, label: '화이트' },
  { value: 'sparkling' as const, label: '스파클링' },
  { value: 'rose' as const, label: '로제' },
  { value: null, label: '상관없어요' },
];

export const BODY_OPTIONS = [
  { value: 'light' as const, label: '가볍고 산뜻하게', desc: '경쾌한 산미, 부담 없는' },
  { value: 'medium' as const, label: '적당한 무게감', desc: '밸런스 좋은 미디엄' },
  { value: 'full' as const, label: '진하고 묵직하게', desc: '풀바디, 농축된 풍미' },
  { value: null, label: '상관없어요', desc: '' },
];

export const PRICE_OPTIONS = [
  { min: null, max: 30000, label: '3만원 이하' },
  { min: 30000, max: 50000, label: '3~5만원' },
  { min: 50000, max: 100000, label: '5~10만원' },
  { min: 100000, max: 200000, label: '10~20만원' },
  { min: 200000, max: null, label: '20만원 이상' },
  { min: null, max: null, label: '상관없어요' },
];

export const OCCASION_OPTIONS = [
  { value: 'gift' as const, label: '선물용', desc: '지인·거래처 선물' },
  { value: 'meal' as const, label: '식사와 함께', desc: '음식 페어링' },
  { value: 'casual' as const, label: '가볍게 한잔', desc: '데일리·혼술' },
  { value: 'special' as const, label: '특별한 날', desc: '기념일·축하' },
  { value: null, label: '상관없어요', desc: '' },
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
