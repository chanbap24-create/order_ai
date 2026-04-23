import { loadRiedelSheet } from '../masterSheet';
import { normalize } from './normalize';
import { compareTwoStrings, characterSimilarity, keywordMatchScore } from './similarity';
import type { RiedelMatchCandidate } from './types';

/**
 * Riedel 시트에서 신규 글라스 품목 검색.
 * English 시트와 동일한 매칭 알고리즘 (단, 분리 매칭 없이 단순화).
 */
export function searchRiedelSheet(
  inputName: string,
  topN: number = 5,
): RiedelMatchCandidate[] {
  const riedelItems = loadRiedelSheet();

  if (riedelItems.length === 0) {
    console.warn('[searchRiedelSheet] No Riedel items loaded');
    return [];
  }

  const inputNorm = normalize(inputName);
  const candidates: RiedelMatchCandidate[] = [];

  for (const item of riedelItems) {
    const englishNorm = normalize(item.englishName);
    const koreanNorm = normalize(item.koreanName);

    const englishBigram = compareTwoStrings(inputNorm, englishNorm);
    const koreanBigram = compareTwoStrings(inputNorm, koreanNorm);

    const englishChar = characterSimilarity(inputNorm, englishNorm);
    const koreanChar = characterSimilarity(inputNorm, koreanNorm);

    const englishContains = koreanNorm.includes(inputNorm) || inputNorm.includes(koreanNorm) ? 0.3 : 0;
    const koreanContains = englishNorm.includes(inputNorm) || inputNorm.includes(englishNorm) ? 0.3 : 0;

    const englishKeywords = keywordMatchScore(inputName, item.englishName);
    const koreanKeywords = keywordMatchScore(inputName, item.koreanName);

    const englishScore = englishBigram * 0.35 + englishChar * 0.20 + englishKeywords * 0.40 + englishContains * 0.05;
    const koreanScore = koreanBigram * 0.35 + koreanChar * 0.20 + koreanKeywords * 0.40 + koreanContains * 0.05;

    const score = Math.max(englishScore, koreanScore);
    if (score < 0.15) continue;

    let matchedBy: 'english' | 'korean' | 'both' = 'both';
    if (englishScore > koreanScore + 0.1) matchedBy = 'english';
    else if (koreanScore > englishScore + 0.1) matchedBy = 'korean';

    candidates.push({
      itemNo: item.itemNo,
      englishName: item.englishName,
      koreanName: item.koreanName,
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
