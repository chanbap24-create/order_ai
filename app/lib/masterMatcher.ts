/**
 * masterMatcher.ts
 * English 시트(order-ai.xlsx)에서 신규 품목을 검색하는 매칭 엔진
 */

import { loadMasterSheet, type MasterItem } from './masterSheet';

/**
 * Dice coefficient (문자열 유사도 계산)
 * string-similarity 패키지 없이 직접 구현
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

export interface MasterMatchCandidate {
  itemNo: string;
  englishName: string;
  koreanName: string;
  vintage?: string;
  score: number;
  matchedBy: 'english' | 'korean' | 'both';
  _debug?: {
    englishScore: number;
    koreanScore: number;
    inputNorm: string;
    targetEnglishNorm: string;
    targetKoreanNorm: string;
  };
}

/**
 * 문자열 정규화 (소문자, 공백 제거, 특수문자 제거)
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * English 시트에서 입력 품목명과 유사한 품목 검색
 * @param inputName - 사용자가 입력한 품목명 (예: "샤또마르고")
 * @param topN - 반환할 상위 후보 개수 (기본 5개)
 * @returns 점수 높은 순으로 정렬된 후보 목록
 */
export function searchMasterSheet(
  inputName: string,
  topN: number = 5
): MasterMatchCandidate[] {
  const masterItems = loadMasterSheet();

  if (masterItems.length === 0) {
    console.warn('[masterMatcher] No master items loaded');
    return [];
  }

  const inputNorm = normalize(inputName);

  if (!inputNorm) {
    return [];
  }

  const candidates: MasterMatchCandidate[] = [];

  for (const item of masterItems) {
    const englishNorm = normalize(item.englishName);
    const koreanNorm = normalize(item.koreanName);

    // 영문명 유사도
    const englishScore = compareTwoStrings(inputNorm, englishNorm);
    
    // 한글명 유사도
    const koreanScore = compareTwoStrings(inputNorm, koreanNorm);

    // 최종 점수: 영문/한글 중 높은 점수 사용
    const score = Math.max(englishScore, koreanScore);

    // 최소 점수 0.3 이상만 후보로 간주
    if (score < 0.3) {
      continue;
    }

    let matchedBy: 'english' | 'korean' | 'both' = 'both';
    if (englishScore > koreanScore + 0.1) {
      matchedBy = 'english';
    } else if (koreanScore > englishScore + 0.1) {
      matchedBy = 'korean';
    }

    candidates.push({
      itemNo: item.itemNo,
      englishName: item.englishName,
      koreanName: item.koreanName,
      vintage: item.vintage,
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

/**
 * 여러 입력 품목에 대해 일괄 검색
 */
export function searchMasterSheetBatch(
  inputNames: string[],
  topN: number = 5
): Record<string, MasterMatchCandidate[]> {
  const results: Record<string, MasterMatchCandidate[]> = {};

  for (const name of inputNames) {
    results[name] = searchMasterSheet(name, topN);
  }

  return results;
}
