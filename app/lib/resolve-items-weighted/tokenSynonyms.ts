/* ================= 와인 토큰 동의어 (스코어링 전용) ================= */
// 다국어 와인 용어를 그룹화 — 같은 그룹의 토큰은 매칭 시 동일하게 취급
export const WINE_TOKEN_SYNONYM_GROUPS: string[][] = [
  ["블랑", "브랑코", "blanc", "branco", "bianco", "blanco"],  // 화이트
  ["루즈", "틴토", "로쏘", "rouge", "tinto", "rosso"],        // 레드
  ["로제", "로사도", "rosé", "rosado", "rosato"],             // 로제
  ["리저브", "리제르바", "레세르바", "reserve", "reserva", "riserva"],
  ["크뤼", "크루", "cru"],
  ["그랑", "그란", "grand", "gran", "grande"],
];

// 빠른 조회용 맵: 토큰 → 그룹 내 모든 동의어
export const tokenSynonymMap = new Map<string, Set<string>>();
for (const group of WINE_TOKEN_SYNONYM_GROUPS) {
  const allNorm = group.map(t => t.toLowerCase());
  for (const t of allNorm) {
    tokenSynonymMap.set(t, new Set(allNorm));
  }
}

/** 두 토큰이 와인 동의어인지 확인 */
export function areTokenSynonyms(a: string, b: string): boolean {
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  if (aLow === bLow) return true;
  const group = tokenSynonymMap.get(aLow);
  return !!group && group.has(bLow);
}
