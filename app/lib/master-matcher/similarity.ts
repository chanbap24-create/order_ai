import { normalize } from './normalize';

/**
 * Dice coefficient (문자열 유사도 계산).
 * string-similarity 패키지 없이 직접 구현.
 */
export function compareTwoStrings(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length < 2 || str2.length < 2) return 0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < str1.length - 1; i++) {
    const bigram = str1.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    bigrams1.set(bigram, count + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < str2.length - 1; i++) {
    const bigram = str2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (str1.length + str2.length - 2);
}

/**
 * Character-level 유사도 (공통 문자 비율).
 * 띄어쓰기 차이에 강건한 보조 매칭 방식.
 */
export function characterSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0;

  const chars1 = new Set(str1.split(''));
  const chars2 = new Set(str2.split(''));

  let common = 0;
  for (const ch of chars1) {
    if (chars2.has(ch)) common++;
  }

  const maxLen = Math.max(chars1.size, chars2.size);
  return maxLen > 0 ? common / maxLen : 0;
}

/**
 * 핵심 단어 추출 (3글자 이상의 의미 있는 단어만).
 */
export function extractKeywords(str: string): Set<string> {
  const words = new Set<string>();

  const cleanStr = str.toLowerCase().replace(/-/g, ' ');
  const englishWords = cleanStr.match(/[a-z]{3,}/g) || [];
  englishWords.forEach((w) => words.add(w));

  const normalized = normalize(str);
  const koreanWords = normalized.match(/[가-힣]{2,}/g) || [];
  koreanWords.forEach((w) => words.add(w));

  return words;
}

/**
 * 핵심 단어 매칭 점수 (부분 품목명 대응).
 * 예: "Grand Cru Le Mesnil" → ["grand", "cru", "mesnil"] → 목표에 모두 있으면 고점.
 */
export function keywordMatchScore(inputStr: string, targetStr: string): number {
  const inputKeywords = extractKeywords(inputStr);
  const targetKeywords = extractKeywords(targetStr);

  if (inputKeywords.size === 0) return 0;

  let matchCount = 0;
  for (const kw of inputKeywords) {
    if (targetKeywords.has(kw)) {
      matchCount++;
      continue;
    }
    // 부분 매칭 (하나가 다른 단어에 포함)
    for (const targetKw of targetKeywords) {
      if (targetKw.includes(kw) || kw.includes(targetKw)) {
        matchCount += 0.8;
        break;
      }
    }
  }

  const ratio = matchCount / inputKeywords.size;
  if (matchCount >= 3) return Math.min(1.0, ratio * 1.3);
  return ratio;
}

/**
 * 부분 토큰 매칭 점수.
 * "산타루치아" vs "산타 루치아"처럼 띄어쓰기 차이를 인식.
 */
export function partialTokenMatch(query: string, targetName: string): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const nameTokens = targetName.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);

  if (qTokens.length < 2 || nameTokens.length < 1) return 0;

  const nameSet = new Set(nameTokens);

  let matchedQTokens = 0;
  let matchedNameTokens = 0;

  for (const qt of qTokens) {
    let found = false;

    if (nameSet.has(qt)) {
      matchedQTokens++;
      matchedNameTokens++;
      continue;
    }

    const qtNorm = normalize(qt);
    let combined = "";
    for (const nt of nameTokens) {
      combined += normalize(nt);
      if (combined === qtNorm) {
        matchedQTokens++;
        matchedNameTokens += combined.length / normalize(nt).length;
        found = true;
        break;
      }
      if (qtNorm.includes(combined) || combined.includes(qtNorm)) {
        matchedQTokens += 0.8;
        matchedNameTokens += 0.8;
        found = true;
        break;
      }
    }

    if (!found) {
      for (const nt of nameTokens) {
        const ntNorm = normalize(nt);
        if (qtNorm.includes(ntNorm) && ntNorm.length >= 3) {
          matchedQTokens += 0.5;
          matchedNameTokens += 0.5;
          break;
        }
      }
    }
  }

  if (matchedQTokens > 0) {
    const recall = matchedQTokens / qTokens.length;
    const precision = matchedNameTokens / nameTokens.length;

    if (recall >= 0.8) return Math.min(0.95, 0.80 + (recall * 0.15) + (precision * 0.05));
    if (recall >= 0.6) return Math.min(0.85, 0.65 + (recall * 0.20));
    if (recall >= 0.5) return Math.min(0.75, 0.55 + (recall * 0.20));
  }

  return 0;
}
