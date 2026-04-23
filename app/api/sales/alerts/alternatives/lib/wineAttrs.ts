export function normalizeGrapes(raw: string): string[] {
  if (!raw) return [];
  return raw.toLowerCase().split(/[,\/]/).map((g) => g.trim()).filter(Boolean);
}

export function grapesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return a.some((ag) => b.some((bg) => ag.includes(bg) || bg.includes(ag)));
}

export function priceInRange(target: number, candidate: number, pct: number): boolean {
  if (target <= 0 || candidate <= 0) return false;
  return Math.abs(candidate - target) / target <= pct;
}

/**
 * 와인 타입 정규화.
 *  - 이름에 명시적 색상 키워드(루즈/블랑/로제/rouge/blanc/rosé 등)가 있으면 DB보다 우선.
 *  - DB 값이 한/영으로 다양해서 하나의 영문 토큰(red/white/rosé/sparkling/fortified)으로 통일.
 *  - DB에 값이 없으면 이름에서 포도품종/지역명 패턴으로 추론.
 */
export function normalizeType(raw: string | null, name?: string): string {
  // 이름에 명시적 색상 키워드가 있으면 DB보다 우선 (데이터 오류 보정)
  if (name) {
    const n = name.toLowerCase();
    if (/(?:^|\s)루즈(?:\s|$|,)/.test(n) || /\brouge\b|\brosso\b/.test(n)) return 'red';
    if (/(?:^|\s)블랑(?:\s|$|,)/.test(n) || /\bblanc\b|\bbianco\b/.test(n)) return 'white';
    if (/(?:^|\s)로제(?:\s|$|,)/.test(n) || /\bros[eé]\b/.test(n)) return 'rosé';
  }
  if (raw) {
    const l = raw.toLowerCase().trim();
    if (l === '화이트' || l === 'white') return 'white';
    if (l === '레드' || l === 'red') return 'red';
    if (l === '로제' || l === 'rosé' || l === 'rose') return 'rosé';
    if (l === '스파클링' || l === 'sparkling') return 'sparkling';
    if (l === '주정강화' || l === 'fortified') return 'fortified';
    if (l) return l;
  }
  // 이름에서 타입 추론
  if (name) {
    const n = name.toLowerCase();
    if (/champagne|prosecco|cava|cr[eé]mant|스파클링|sparkling/.test(n)) return 'sparkling';
    if (/chardonnay|sauvignon\s*blanc|riesling|chenin|viognier|pinot\s*grigio|pinot\s*gris|melon|muscat|gewurz|marsanne|roussanne/.test(n)) return 'white';
    if (/샤블리|chablis|뫼르소|meursault|퓔리니|puligny|꼬르통\s*샤를|corton.charlemagne|몽라셰|montrachet/.test(n)) return 'white';
    if (/cabernet|merlot|pinot\s*noir|syrah|shiraz|malbec|tempranillo|sangiovese|nebbiolo|grenache|mourvèdre|gamay|barbera|zinfandel/.test(n)) return 'red';
    if (/뮈지니|musigny|볼네|volnay|포마르|pommard|제브레|gevrey|에셰조|echezeaux|샹볼|chambolle|모레\s*생|morey|본\s*로마네|vosne|보졸레|beaujolais|뉘이\s*생|nuits.st/.test(n)) return 'red';
    if (/마고|margaux|뽀이약|pauillac|생\s*테밀리옹|st.emilion|생\s*줄리앙|st.julien|메독|medoc|샤또뇌프|chateauneuf/.test(n)) return 'red';
    if (/port|sherry|madeira|주정강화/.test(n)) return 'fortified';
  }
  return '';
}
