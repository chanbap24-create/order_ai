/* ── 가격별 최소 재고 임계치 ── */
export const DEFAULT_STOCK_RULES = {
  price_300k: 6, price_200k: 12, price_100k: 60,
  price_50k: 120, price_20k: 180, price_under_20k: 300,
};

export function minStockForPrice(price: number): number {
  if (price >= 300000) return DEFAULT_STOCK_RULES.price_300k;
  if (price >= 200000) return DEFAULT_STOCK_RULES.price_200k;
  if (price >= 100000) return DEFAULT_STOCK_RULES.price_100k;
  if (price >= 50000) return DEFAULT_STOCK_RULES.price_50k;
  if (price >= 20000) return DEFAULT_STOCK_RULES.price_20k;
  return DEFAULT_STOCK_RULES.price_under_20k;
}

/* ── 와인 이름에서 품종/타입 추출 ── */
const GRAPE_PATTERNS: { pattern: RegExp; grape: string }[] = [
  { pattern: /카베르네\s?소비뇽|cabernet\s?sauvignon/i, grape: 'Cabernet Sauvignon' },
  { pattern: /소비뇽\s?블랑|sauvignon\s?blanc/i, grape: 'Sauvignon Blanc' },
  { pattern: /피노\s?누아|피노누아|pinot\s?noir/i, grape: 'Pinot Noir' },
  { pattern: /샤르도네|chardonnay/i, grape: 'Chardonnay' },
  { pattern: /메를로|merlot/i, grape: 'Merlot' },
  { pattern: /시라|쉬라즈|syrah|shiraz/i, grape: 'Syrah' },
  { pattern: /리슬링|riesling/i, grape: 'Riesling' },
  { pattern: /말벡|malbec/i, grape: 'Malbec' },
  { pattern: /템프라니요|tempranillo/i, grape: 'Tempranillo' },
  { pattern: /산지오베제|sangiovese/i, grape: 'Sangiovese' },
  { pattern: /네비올로|nebbiolo/i, grape: 'Nebbiolo' },
  { pattern: /그르나슈|그르나쉬|grenache|garnacha/i, grape: 'Grenache' },
  { pattern: /진판델|zinfandel/i, grape: 'Zinfandel' },
];

const TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /스파클링|sparkling|크레망|cremant|프로세코|prosecco|까바|cava|샴페인|champagne|브륏|brut/i, type: '스파클링' },
  { pattern: /로제|rosé|rose/i, type: '로제' },
  { pattern: /소비뇽\s?블랑|샤르도네|리슬링|비오니에|피노\s?그리|모스카토|블랑|bianco|blanc|white|화이트/i, type: '화이트' },
  { pattern: /카베르네|피노\s?누아|메를로|시라|쉬라즈|말벡|산지오베제|네비올로|그르나슈|진판델|루쥬|rosso|rouge|레드|tinto/i, type: '레드' },
];

export function extractGrapesFromName(name: string): string[] {
  if (!name) return [];
  const grapes: string[] = [];
  for (const { pattern, grape } of GRAPE_PATTERNS) {
    if (pattern.test(name)) grapes.push(grape);
  }
  return grapes;
}

export function extractTypeFromName(name: string): string {
  if (!name) return '';
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return '';
}

/* ── 시즌 매핑 ── */
export function getSeasonInfo(month: number): { season: string; types: string[]; grapes: string[] } {
  if (month >= 3 && month <= 5) {
    return { season: '봄', types: ['로제'], grapes: ['Sauvignon Blanc', 'Riesling'] };
  }
  if (month >= 6 && month <= 8) {
    return { season: '여름', types: ['스파클링', '화이트', '로제'], grapes: [] };
  }
  if (month >= 9 && month <= 11) {
    return { season: '가을', types: [], grapes: ['Pinot Noir'] };
  }
  return { season: '겨울', types: [], grapes: ['Syrah', 'Cabernet Sauvignon'] };
}

export const DAY_MS = 1000 * 60 * 60 * 24;
