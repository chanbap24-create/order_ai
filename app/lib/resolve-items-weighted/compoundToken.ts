/* ================= 복합 토큰 분해 매칭 ================= */

/**
 * 알려진 와인 품종/산지/용어를 기반으로 공백 없이 붙여쓴 한글 쿼리를 분해
 * 예: "아이니샤르도네" → ["아이니", "샤르도네"]
 * 예: "후플라카베르네소비뇽" → ["후플라", "카베르네소비뇽"]
 */
const KNOWN_WINE_TOKENS = [
  // 품종 (길이 내림차순 - 긴 것 먼저 매칭)
  '카베르네소비뇽', '소비뇽블랑', '피노누아', '샤르도네', '리슬링',
  '메를로', '시라', '말벡', '그르나슈', '피노그리', '피노블랑',
  '템프라니요', '산지오베제', '네비올로', '무르베드르', '비오니에',
  '게뷔르츠트라미너', '블랑드블랑', '블랑드누아',
  // 산지/유형
  '샤블리', '부르고뉴', '보르도', '상세르', '프이퓌세', '뫼르소',
  '볼네양보', '본로마네', '사비니레본', '뉘생조르쥬',
  '그랑크뤼', '프르미에크뤼', '비에유비뉴',
  // 일반 용어
  '블랑', '루즈', '로제', '레드', '화이트', '브뤼', '나뛰르',
  '레제르브', '그랑레제르브', '퀴베',
];

export function decomposeCompoundKorean(normalizedQuery: string): string[] {
  let remaining = normalizedQuery;
  const tokens: string[] = [];

  // 알려진 토큰을 길이 내림차순으로 검색하여 추출
  for (const token of KNOWN_WINE_TOKENS) {
    const idx = remaining.indexOf(token);
    if (idx !== -1) {
      // 토큰 앞부분이 있으면 추가
      const before = remaining.substring(0, idx);
      if (before.length >= 2) {
        tokens.push(before);
      }
      tokens.push(token);
      remaining = remaining.substring(idx + token.length);
    }
  }

  // 남은 부분이 있으면 추가
  if (remaining.length >= 2) {
    tokens.push(remaining);
  }

  return tokens.length >= 2 ? tokens : [];
}

/**
 * 복합 토큰 분해 후 매칭 점수 계산
 * 모든 토큰이 후보 품목명에 존재하면 높은 점수, 일부만 있으면 낮은 점수
 */
export function scoreCompoundTokenMatch(normalizedQuery: string, normalizedTarget: string): number {
  const tokens = decomposeCompoundKorean(normalizedQuery);
  if (tokens.length < 2) return 0;

  let matchedCount = 0;
  for (const token of tokens) {
    if (normalizedTarget.includes(token)) {
      matchedCount++;
    }
  }

  const recall = matchedCount / tokens.length;

  if (recall >= 1.0) {
    // 모든 토큰이 후보에 존재 → 0.95 (강력한 신호)
    return 0.95;
  } else if (recall >= 0.5) {
    // 절반 이상 매칭
    return 0.55 + (recall * 0.15);
  }

  return 0;
}

/* ================= 빈티지 힌트 ================= */

export function hasVintageHint(text: string): boolean {
  return /\b(19|20)\d{2}\b/.test(text) || /\b\d{2}\b/.test(text);
}
