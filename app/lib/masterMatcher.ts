/**
 * masterMatcher.ts
 * English 시트(order-ai.xlsx)에서 신규 품목을 검색하는 매칭 엔진
 */

import { loadMasterSheet, loadAllMasterItemsV2, type MasterItem } from './masterSheet';

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

/**
 * 부분 토큰 매칭 점수 계산
 * "산타루치아" vs "산타 루치아"처럼 띄어쓰기 차이를 인식
 */
function partialTokenMatch(query: string, targetName: string): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const nameTokens = targetName.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length < 2 || nameTokens.length < 1) {
    return 0;
  }
  
  const qSet = new Set(qTokens);
  const nameSet = new Set(nameTokens);
  
  let matchedQTokens = 0;
  let matchedNameTokens = 0;
  
  for (const qt of qTokens) {
    let found = false;
    
    // 정확 매칭 체크
    if (nameSet.has(qt)) {
      matchedQTokens++;
      matchedNameTokens++;
      found = true;
      continue;
    }
    
    // 부분 매칭 체크: "산타루치아" vs ["산타", "루치아"]
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
    
    // 반대 방향도 체크: ["산타", "루치아"] in "산타루치아"
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
    
    // 입력 토큰의 80% 이상 매칭되면 높은 점수
    if (recall >= 0.8) {
      return Math.min(0.95, 0.80 + (recall * 0.15) + (precision * 0.05));
    }
    // 입력 토큰의 60% 이상 매칭
    if (recall >= 0.6) {
      return Math.min(0.85, 0.65 + (recall * 0.20));
    }
    // 입력 토큰의 50% 이상 매칭
    if (recall >= 0.5) {
      return Math.min(0.75, 0.55 + (recall * 0.20));
    }
  }
  
  return 0;
}

export interface MasterMatchCandidate {
  itemNo: string;
  englishName: string;
  koreanName: string;
  vintage?: string;
  supplyPrice?: number; // ✅ 공급가 추가
  score: number;
  matchedBy: 'english' | 'korean' | 'both' | 'pytorch_ml';
  _debug?: {
    englishScore?: number;
    koreanScore?: number;
    inputNorm?: string;
    targetEnglishNorm?: string;
    targetKoreanNorm?: string;
    method?: string;
    korean_name?: string;
    english_name?: string;
  };
}

/**
 * 입력 문자열에서 한글 부분과 영문 부분을 분리
 */
function separateKoreanEnglish(input: string): { korean: string; english: string } {
  // ✅ 먼저 곡선 따옴표와 특수문자 제거
  const cleaned = input
    .replace(/[""'']/g, '')  // 곡선 따옴표 제거
    .replace(/[^\w가-힣\s]/g, ' ');  // 특수문자를 공백으로 변환
  
  // 한글만 추출
  const korean = cleaned.match(/[가-힣\s]+/g)?.join(' ').trim() || '';
  
  // 영문+숫자만 추출
  const english = cleaned.match(/[a-zA-Z0-9\s]+/g)?.join(' ').trim() || '';
  
  return { korean, english };
}

/**
 * 문자열 정규화 (소문자, 공백 완전 제거, 특수문자 제거)
 * 띄어쓰기 차이를 무시하기 위해 공백을 완전히 제거합니다.
 * ✅ 악센트 제거 + 따옴표 통일 추가
 */
function normalize(str: string): string {
  let normalized = str
    .toLowerCase()
    // ✅ 1) 곡선 따옴표 → 일반 따옴표
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // ✅ 2) NFD 정규화 후 악센트 제거
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // 3) 영문자, 숫자, 한글만 남기기
    .replace(/[^a-z0-9가-힣]/g, '')
    .trim();

  // 와인 관련 발음 변형 통일
  normalized = normalized
    .replace(/샤또/g, '샤토')
    .replace(/쌔또/g, '샤토')
    .replace(/샤도/g, '샤토')
    .replace(/샤또/g, '샤토')
    .replace(/샤뜨/g, '샤토')
    .replace(/쁘띠/g, '프티')
    .replace(/빠비용/g, '파비용')
    .replace(/쌩떼밀리옹/g, '생테밀리옹')
    .replace(/메독/g, '메도')
    .replace(/뽀이약/g, '포이약')
    .replace(/마르고/g, '마고')
    .replace(/샤르도네이/g, '샤르도네')
    .replace(/샤도네이/g, '샤르도네')
    .replace(/샤도네/g, '샤르도네')
    // 루이미쉘 관련
    .replace(/루이미쉘/g, '루이미셸')
    .replace(/루이미셸/g, '루이미셸')
    .replace(/louismichel/g, 'louismichel')
    // 몬테 드 토네르/토네흐 통일
    .replace(/토네흐/g, '토네르')
    .replace(/토네르/g, '토네르')
    // 샤블리 관련 (몬테 드 토네르)
    .replace(/monteedetonnerre/g, '몬테드토네흐')
    .replace(/몬테드토네르/g, '몬테드토네흐')
    .replace(/몬테드토네흐/g, '몬테드토네흐')
    .replace(/monteedetonnerre/g, '몬테드토네흐')
    // 르메닐쉬르오제 (크리스토프 피뚜아)
    .replace(/lemesnilsuroger/g, '르메닐쉬르오제')
    .replace(/르메닐쉬르오제/g, '르메닐쉬르오제')
    .replace(/mesnil/g, '메닐')
    .replace(/메스닐/g, '메닐');

  return normalized;
}

/**
 * Character-level 유사도 계산 (공통 문자 비율)
 * 띄어쓰기 차이에 강건한 추가 매칭 방식
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
 * 핵심 단어 매칭 점수 (부분 품목명 대응)
 * 예: "Grand Cru Le Mesnil" -> ["grand", "cru", "mesnil"]
 * 목표 품목에 이 단어들이 모두 있으면 높은 점수
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
        matchCount += 0.8; // 부분 매칭은 0.8점 (이전 0.7)
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
 * English 시트에서 입력 품목명과 유사한 품목 검색
 * @param inputName - 사용자가 입력한 품목명 (예: "샤또마르고")
 * @param topN - 반환할 상위 후보 개수 (기본 5개)
 * @returns 점수 높은 순으로 정렬된 후보 목록
 */
export function searchMasterSheet(
  inputName: string,
  topN: number = 5
): MasterMatchCandidate[] {
  const masterItems = loadAllMasterItemsV2(); // ✅ English + Downloads 통합 (V2)

  if (masterItems.length === 0) {
    console.warn('[masterMatcher] No master items loaded');
    return [];
  }

  const inputNorm = normalize(inputName);

  if (!inputNorm) {
    return [];
  }

  // ✅ 한글과 영문을 분리
  const { korean: inputKorean, english: inputEnglish } = separateKoreanEnglish(inputName);
  const inputKoreanNorm = normalize(inputKorean);
  const inputEnglishNorm = normalize(inputEnglish);

  const candidates: MasterMatchCandidate[] = [];

  for (const item of masterItems) {
    const englishNorm = normalize(item.englishName);
    const koreanNorm = normalize(item.koreanName);

    // 1) Bigram 유사도
    const englishBigram = compareTwoStrings(inputNorm, englishNorm);
    const koreanBigram = compareTwoStrings(inputNorm, koreanNorm);
    
    // ✅ 분리된 한글/영문으로 각각 매칭
    const englishBigramSeparate = inputEnglishNorm ? compareTwoStrings(inputEnglishNorm, englishNorm) : 0;
    const koreanBigramSeparate = inputKoreanNorm ? compareTwoStrings(inputKoreanNorm, koreanNorm) : 0;

    // 2) Character 유사도
    const englishChar = characterSimilarity(inputNorm, englishNorm);
    const koreanChar = characterSimilarity(inputNorm, koreanNorm);
    
    // ✅ 분리된 한글/영문으로 character 유사도
    const englishCharSeparate = inputEnglishNorm ? characterSimilarity(inputEnglishNorm, englishNorm) : 0;
    const koreanCharSeparate = inputKoreanNorm ? characterSimilarity(inputKoreanNorm, koreanNorm) : 0;

    // 3) Contains 체크
    const englishContains = englishNorm.includes(inputNorm) || inputNorm.includes(englishNorm) ? 0.3 : 0;
    const koreanContains = koreanNorm.includes(inputNorm) || inputNorm.includes(koreanNorm) ? 0.3 : 0;
    
    // ✅ 분리된 한글/영문으로 contains 체크 (더 높은 가중치)
    const englishContainsSeparate = inputEnglishNorm && (englishNorm.includes(inputEnglishNorm) || inputEnglishNorm.includes(englishNorm)) ? 0.4 : 0;
    const koreanContainsSeparate = inputKoreanNorm && (koreanNorm.includes(inputKoreanNorm) || inputKoreanNorm.includes(koreanNorm)) ? 0.4 : 0;

    // 4) 핵심 단어 매칭 - ✅ 분리된 한글/영문으로 각각 매칭
    const englishKeywords = inputEnglish ? keywordMatchScore(inputEnglish, item.englishName) : 0;
    const koreanKeywords = inputKorean ? keywordMatchScore(inputKorean, item.koreanName) : 0;
    const maxKeywords = Math.max(englishKeywords, koreanKeywords);

    // 5) 부분 토큰 매칭 - ✅ 분리된 한글/영문으로 각각 매칭
    const englishPartial = inputEnglish ? partialTokenMatch(inputEnglish, item.englishName) : 0;
    const koreanPartial = inputKorean ? partialTokenMatch(inputKorean, item.koreanName) : 0;
    const maxPartial = Math.max(englishPartial, koreanPartial);

    // 영문명 최종 점수
    const englishScore = englishBigram * 0.20 + englishChar * 0.15 + englishKeywords * 0.30 + englishPartial * 0.30 + englishContains * 0.05;
    
    // 한글명 최종 점수
    const koreanScore = koreanBigram * 0.20 + koreanChar * 0.15 + koreanKeywords * 0.30 + koreanPartial * 0.30 + koreanContains * 0.05;
    
    // ✅ 분리 매칭 점수 (한글은 한글명과, 영문은 영문명과 매칭)
    // 한글 입력 → 한글명 매칭
    const koreanSeparateScore = inputKoreanNorm ? 
      (koreanBigramSeparate * 0.25 + koreanCharSeparate * 0.20 + koreanKeywords * 0.30 + koreanPartial * 0.20 + koreanContainsSeparate * 0.05) : 0;
    
    // 영문 입력 → 영문명 매칭
    const englishSeparateScore = inputEnglishNorm ?
      (englishBigramSeparate * 0.25 + englishCharSeparate * 0.20 + englishKeywords * 0.30 + englishPartial * 0.20 + englishContainsSeparate * 0.05) : 0;
    
    // 혼합 입력인 경우: 한글 점수 + 영문 점수 평균
    const mixedScore = (inputKoreanNorm && inputEnglishNorm) ? 
      (koreanSeparateScore * 0.5 + englishSeparateScore * 0.5) : 0;

    // 최종 점수: 여러 방식 중 최고값
    // - 전체 입력으로 영문 매칭
    // - 전체 입력으로 한글 매칭  
    // - 분리된 영문만으로 영문 매칭 (영문 입력일 때 더 정확)
    // - 분리된 한글만으로 한글 매칭 (한글 입력일 때 더 정확)
    // - 혼합 점수 (한글+영문 혼합 입력일 때)
    const score = Math.max(
      englishScore, 
      koreanScore, 
      englishSeparateScore,  // ✅ 추가
      koreanSeparateScore,   // ✅ 추가
      mixedScore
    );

    // 최소 점수 0.15 이상만 후보로 간주 (더 낮춤 - 신규 품목 검색용)
    if (score < 0.15) {
      continue;
    }

    let matchedBy: 'english' | 'korean' | 'both' = 'both';
    if (englishScore > koreanScore + 0.1) {
      matchedBy = 'english';
    } else if (koreanScore > englishScore + 0.1) {
      matchedBy = 'korean';
    }

    // ✅ 공급가 디버깅 로그 (찰스 하이직 관련은 모두 로그)
    if (candidates.length < 3 || item.itemNo.startsWith('00NV8') || item.koreanName.includes('찰스')) {
      console.log(`[masterMatcher] ${item.itemNo}: ${item.koreanName}, supplyPrice=${item.supplyPrice}, score=${score.toFixed(3)}`);
    }
    
    candidates.push({
      itemNo: item.itemNo,
      englishName: item.englishName,
      koreanName: item.koreanName,
      vintage: item.vintage,
      supplyPrice: item.supplyPrice, // ✅ 공급가 추가
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

/* ==================== Riedel 시트 검색 (Glass용) ==================== */

import { loadRiedelSheet, type RiedelItem } from './masterSheet';

export interface RiedelMatchCandidate {
  itemNo: string;
  englishName: string;
  koreanName: string;
  supplyPrice?: number;
  score: number;
  matchedBy: 'english' | 'korean' | 'both';
  _debug?: {
    englishScore?: number;
    koreanScore?: number;
    inputNorm?: string;
    targetEnglishNorm?: string;
    targetKoreanNorm?: string;
    method?: string;
  };
}

/**
 * Riedel 시트에서 신규 품목 검색 (Glass용)
 * English 시트와 동일한 매칭 알고리즘 사용
 */
export function searchRiedelSheet(
  inputName: string,
  topN: number = 5
): RiedelMatchCandidate[] {
  const riedelItems = loadRiedelSheet();
  
  if (riedelItems.length === 0) {
    console.warn('[searchRiedelSheet] No Riedel items loaded');
    return [];
  }

  const inputNorm = normalize(inputName);
  const inputKeywords = extractKeywords(inputName);

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

    // 최종 점수
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
      itemNo: item.itemNo,
      englishName: item.englishName,
      koreanName: item.koreanName,
      supplyPrice: item.supplyPrice,
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
