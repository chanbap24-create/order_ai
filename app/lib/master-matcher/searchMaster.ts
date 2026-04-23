import { loadAllMasterItemsV2 } from '../masterSheet';
import { normalize, separateKoreanEnglish } from './normalize';
import { compareTwoStrings, characterSimilarity, keywordMatchScore, partialTokenMatch } from './similarity';
import type { MasterMatchCandidate } from './types';

/**
 * English+Downloads 통합 마스터에서 입력 품목명과 유사한 품목 검색.
 * @param inputName 사용자가 입력한 품목명 (예: "샤또마르고")
 * @param topN 반환할 상위 후보 개수 (기본 5)
 */
export function searchMasterSheet(
  inputName: string,
  topN: number = 5,
): MasterMatchCandidate[] {
  const masterItems = loadAllMasterItemsV2();

  if (masterItems.length === 0) {
    console.warn('[masterMatcher] No master items loaded');
    return [];
  }

  const inputNorm = normalize(inputName);
  if (!inputNorm) return [];

  // 한글 / 영문 분리 (분리 매칭으로 혼합 입력도 처리)
  const { korean: inputKorean, english: inputEnglish } = separateKoreanEnglish(inputName);
  const inputKoreanNorm = normalize(inputKorean);
  const inputEnglishNorm = normalize(inputEnglish);

  const candidates: MasterMatchCandidate[] = [];

  for (const item of masterItems) {
    const englishNorm = normalize(item.englishName);
    const koreanNorm = normalize(item.koreanName);

    // 1) Bigram
    const englishBigram = compareTwoStrings(inputNorm, englishNorm);
    const koreanBigram = compareTwoStrings(inputNorm, koreanNorm);
    const englishBigramSeparate = inputEnglishNorm ? compareTwoStrings(inputEnglishNorm, englishNorm) : 0;
    const koreanBigramSeparate = inputKoreanNorm ? compareTwoStrings(inputKoreanNorm, koreanNorm) : 0;

    // 2) Character
    const englishChar = characterSimilarity(inputNorm, englishNorm);
    const koreanChar = characterSimilarity(inputNorm, koreanNorm);
    const englishCharSeparate = inputEnglishNorm ? characterSimilarity(inputEnglishNorm, englishNorm) : 0;
    const koreanCharSeparate = inputKoreanNorm ? characterSimilarity(inputKoreanNorm, koreanNorm) : 0;

    // 3) Contains
    const englishContains = englishNorm.includes(inputNorm) || inputNorm.includes(englishNorm) ? 0.3 : 0;
    const koreanContains = koreanNorm.includes(inputNorm) || inputNorm.includes(koreanNorm) ? 0.3 : 0;
    const englishContainsSeparate = inputEnglishNorm && (englishNorm.includes(inputEnglishNorm) || inputEnglishNorm.includes(englishNorm)) ? 0.4 : 0;
    const koreanContainsSeparate = inputKoreanNorm && (koreanNorm.includes(inputKoreanNorm) || inputKoreanNorm.includes(koreanNorm)) ? 0.4 : 0;

    // 4) Keyword
    const englishKeywords = inputEnglish ? keywordMatchScore(inputEnglish, item.englishName) : 0;
    const koreanKeywords = inputKorean ? keywordMatchScore(inputKorean, item.koreanName) : 0;

    // 5) Partial token
    const englishPartial = inputEnglish ? partialTokenMatch(inputEnglish, item.englishName) : 0;
    const koreanPartial = inputKorean ? partialTokenMatch(inputKorean, item.koreanName) : 0;

    const englishScore =
      englishBigram * 0.20 + englishChar * 0.15 + englishKeywords * 0.30 + englishPartial * 0.30 + englishContains * 0.05;
    const koreanScore =
      koreanBigram * 0.20 + koreanChar * 0.15 + koreanKeywords * 0.30 + koreanPartial * 0.30 + koreanContains * 0.05;

    // 한글 입력 → 한글명 매칭
    const koreanSeparateScore = inputKoreanNorm
      ? (koreanBigramSeparate * 0.25 + koreanCharSeparate * 0.20 + koreanKeywords * 0.30 + koreanPartial * 0.20 + koreanContainsSeparate * 0.05)
      : 0;
    // 영문 입력 → 영문명 매칭
    const englishSeparateScore = inputEnglishNorm
      ? (englishBigramSeparate * 0.25 + englishCharSeparate * 0.20 + englishKeywords * 0.30 + englishPartial * 0.20 + englishContainsSeparate * 0.05)
      : 0;
    // 혼합 입력
    const mixedScore = (inputKoreanNorm && inputEnglishNorm)
      ? (koreanSeparateScore * 0.5 + englishSeparateScore * 0.5)
      : 0;

    // 최종: 여러 방식 중 최고값
    const score = Math.max(
      englishScore, koreanScore,
      englishSeparateScore, koreanSeparateScore,
      mixedScore,
    );

    if (score < 0.15) continue;

    let matchedBy: 'english' | 'korean' | 'both' = 'both';
    if (englishScore > koreanScore + 0.1) matchedBy = 'english';
    else if (koreanScore > englishScore + 0.1) matchedBy = 'korean';

    if (candidates.length < 3 || item.itemNo.startsWith('00NV8') || item.koreanName.includes('찰스')) {
      console.log(`[masterMatcher] ${item.itemNo}: ${item.koreanName}, supplyPrice=${item.supplyPrice}, score=${score.toFixed(3)}`);
    }

    candidates.push({
      itemNo: item.itemNo,
      englishName: item.englishName,
      koreanName: item.koreanName,
      vintage: item.vintage,
      supplyPrice: item.supplyPrice,
      score,
      matchedBy,
      _debug: {
        englishScore, koreanScore,
        inputNorm,
        targetEnglishNorm: englishNorm,
        targetKoreanNorm: koreanNorm,
      },
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topN);
}

/**
 * 여러 입력에 대해 일괄 검색.
 */
export function searchMasterSheetBatch(
  inputNames: string[],
  topN: number = 5,
): Record<string, MasterMatchCandidate[]> {
  const results: Record<string, MasterMatchCandidate[]> = {};
  for (const name of inputNames) {
    results[name] = searchMasterSheet(name, topN);
  }
  return results;
}
