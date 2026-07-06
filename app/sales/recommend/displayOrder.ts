// 견적 '표시' 정렬 전용(점수 정렬과 별개): 타입 → 국가 → 공급가 내림차순.
// 서버(orderForDisplay)·클라(RecommendQuoteTab) 공용 — 순수 함수, 서버 의존성 없음.

export const QUOTE_TYPE_RANK: Record<string, number> = {
  '스파클링': 0, '화이트': 1, '레드': 2, '로제': 3, '주정강화': 4, '스위트': 5,
};

// 국가 우선순위(영업 지정). 목록 밖 국가(독일·오스트리아 등)는 뒤로(50).
const COUNTRY_ORDER: Array<[string[], number]> = [
  [['영국', '잉글랜드', 'england', 'uk', 'united kingdom'], 0],
  [['프랑스', 'france'], 1],
  [['이탈리아', '이태리', 'italy', 'italia'], 2],
  [['포르투갈', '포르투칼', 'portugal'], 3],
  [['스페인', 'spain', 'espa'], 4],
  [['미국', 'usa', 'united states', 'u.s', 'america'], 5],
  [['칠레', 'chile'], 6],
  [['호주', '오스트레일리아', 'australia'], 7],
  [['뉴질', 'new zealand', 'newzealand'], 8],
  [['아르헨', 'argentin'], 9],
];

export function countryRank(country?: string): number {
  const s = (country || '').toLowerCase().trim();
  if (!s) return 50;
  for (const [keys, r] of COUNTRY_ORDER) if (keys.some((k) => s.includes(k))) return r;
  return 50;
}

/** 표시 정렬 비교자: 타입 그룹 → 국가 우선순위 → 공급가 내림차순. */
export function compareForDisplay(
  a: { wine_type?: string; country?: string; price?: number },
  b: { wine_type?: string; country?: string; price?: number },
): number {
  const ta = QUOTE_TYPE_RANK[a.wine_type ?? ''] ?? 9;
  const tb = QUOTE_TYPE_RANK[b.wine_type ?? ''] ?? 9;
  if (ta !== tb) return ta - tb;
  const ca = countryRank(a.country), cb = countryRank(b.country);
  if (ca !== cb) return ca - cb;
  return (b.price || 0) - (a.price || 0);
}
