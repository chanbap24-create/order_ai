/**
 * riedelMatcher.ts
 * Riedel 시트(order-ai.xlsx)에서 신규 Glass 품목을 검색하는 매칭 엔진
 */

import { loadRiedelSheet, type RiedelItem } from './riedelSheet';

/**
 * Dice coefficient (문자열 유사도 계산)
 */
function compareTwoStrings(str1: string, str2: string): number {
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

export interface RiedelMatchCandidate {
  code: string;
  koreanName: string;
  englishName: string;
  price: number;
  score: number;
  matchedBy: 'english' | 'korean' | 'both';
  _debug?: {
    englishScore?: number;
    koreanScore?: number;
    inputNorm?: string;
    targetEnglishNorm?: string;
    targetKoreanNorm?: string;
  };
}

/**
 * 문자열 정규화 (소문자, 공백 완전 제거, 특수문자 제거)
 */
function normalize(str: string): string {
  let normalized = str
    .toLowerCase()
    .replace(/[^\w가-힣]/g, '') // 공백 포함 모든 특수문자 제거
    .trim();

  // Glass 관련 발음 변형 통일
  normalized = normalized
    .replace(/레드타이/g, '레드타이')
    .replace(/블랙타이/g, '블랙타이')
    .replace(/리델/g, '리델')
    .replace(/라이델/g, '리델')
    .replace(/쉬피겔라우/g, '쉬피겔라우')
    .replace(/쉬피겔로/g, '쉬피겔라우')
    .replace(/츠비젤/g, '츠비젤')
    .replace(/츠비셀/g, '츠비젤')
    .replace(/샴페인/g, '샴페인')
    .replace(/샹페인/g, '샴페인')
    .replace(/샤르도네/g, '샤르도네')
    .replace(/샤도네/g, '샤르도네')
    .replace(/보르도/g, '보르도')
    .replace(/보도/g, '보르도')
    .replace(/버건디/g, '버건디')
    .replace(/부르고뉴/g, '버건디')
    .replace(/그랑크뤼/g, '그랑크뤼')
    .replace(/그랑크루/g, '그랑크뤼');

  return normalized;
}

/**
 * Character-level 유사도 계산 (공통 문자 비율)
 */
function characterSimilarity(str1: string, str2: string): number {
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
 * 핵심 단어 추출 (3글자 이상의 의미 있는 단어만)
 */
function extractKeywords(str: string): Set<string> {
  const words = new Set<string>();
  
  // 영문 단어 추출 (3글자 이상) - 하이픈으로 연결된 단어도 분리
  const cleanStr = str.toLowerCase().replace(/-/g, ' '); // 하이픈을 공백으로 변환
  const englishWords = cleanStr.match(/[a-z]{3,}/g) || [];
  englishWords.forEach(w => words.add(w));
  
  // 한글 단어 추출 (2글자 이상)
  const normalized = normalize(str);
  const koreanWords = normalized.match(/[가-힣]{2,}/g) || [];
  koreanWords.forEach(w => words.add(w));
  
  return words;
}

/**
 * 핵심 단어 매칭 점수
 */
function keywordMatchScore(inputStr: string, targetStr: string): number {
  const inputKeywords = extractKeywords(inputStr);
  const targetKeywords = extractKeywords(targetStr);
  
  if (inputKeywords.size === 0) return 0;
  
  let matchCount = 0;
  for (const kw of inputKeywords) {
    // 정확 매칭
    if (targetKeywords.has(kw)) {
      matchCount++;
      continue;
    }
    
    // 부분 매칭 (하나의 단어가 다른 단어에 포함)
    for (const targetKw of targetKeywords) {
      if (targetKw.includes(kw) || kw.includes(targetKw)) {
        matchCount += 0.8; // 부분 매칭은 0.8점
        break;
      }
    }
  }
  
  // 점수를 0-1 범위로 정규화하되, 매칭 비율에 따라 보너스 부여
  const ratio = matchCount / inputKeywords.size;
  
  // 3개 이상 키워드 매칭 시 보너스
  if (matchCount >= 3) {
    return Math.min(1.0, ratio * 1.3); // 30% 보너스
  }
  
  return ratio;
}

/**
 * Riedel 시트에서 입력 품목명과 유사한 품목 검색
 * @param inputName - 사용자가 입력한 품목명 (예: "레드타이 보르도")
 * @param topN - 반환할 상위 후보 개수 (기본 3개)
 * @returns 점수 높은 순으로 정렬된 후보 목록
 */
export function searchRiedelSheet(
  inputName: string,
  topN: number = 3
): RiedelMatchCandidate[] {
  const riedelItems = loadRiedelSheet();

  if (riedelItems.length === 0) {
    console.warn('[riedelMatcher] No riedel items loaded');
    return [];
  }

  const inputNorm = normalize(inputName);

  if (!inputNorm) {
    return [];
  }

  const candidates: RiedelMatchCandidate[] = [];

  for (const item of riedelItems) {
    const englishNorm = normalize(item.englishName);
    const koreanNorm = normalize(item.koreanName);

    // 1) Bigram 유사도
    const englishBigram = compareTwoStrings(inputNorm, englishNorm);
    const koreanBigram = compareTwoStrings(inputNorm, koreanNorm);

    // 2) Character 유사도
    const englishChar = characterSimilarity(inputNorm, englishNorm);
    const koreanChar = characterSimilarity(inputNorm, koreanNorm);

    // 3) Contains 체크
    const englishContains = koreanNorm.includes(inputNorm) || inputNorm.includes(koreanNorm) ? 0.3 : 0;
    const koreanContains = englishNorm.includes(inputNorm) || inputNorm.includes(englishNorm) ? 0.3 : 0;

    // 4) 핵심 단어 매칭
    const englishKeywords = keywordMatchScore(inputName, item.englishName);
    const koreanKeywords = keywordMatchScore(inputName, item.koreanName);

    // 영문명 최종 점수
    const englishScore = englishBigram * 0.35 + englishChar * 0.20 + englishKeywords * 0.40 + englishContains * 0.05;
    
    // 한글명 최종 점수
    const koreanScore = koreanBigram * 0.35 + koreanChar * 0.20 + koreanKeywords * 0.40 + koreanContains * 0.05;

    // 최종 점수: 영문/한글 중 높은 점수 사용
    const score = Math.max(englishScore, koreanScore);

    // 최소 점수 0.15 이상만 후보로 간주
    if (score < 0.15) {
      continue;
    }

    let matchedBy: 'english' | 'korean' | 'both' = 'both';
    if (englishScore > koreanScore + 0.1) {
      matchedBy = 'english';
    } else if (koreanScore > englishScore + 0.1) {
      matchedBy = 'korean';
    }

    candidates.push({
      code: item.code,
      koreanName: item.koreanName,
      englishName: item.englishName,
      price: item.price,
      score,
      matchedBy,
      _debug: {
        englishScore,
        koreanScore,
        inputNorm,
        targetEnglishNorm: englishNorm,
        targetKoreanNorm: koreanNorm,
      },
    });
  }

  // 점수 높은 순으로 정렬
  candidates.sort((a, b) => b.score - a.score);

  // 상위 topN개만 반환
  return candidates.slice(0, topN);
}
