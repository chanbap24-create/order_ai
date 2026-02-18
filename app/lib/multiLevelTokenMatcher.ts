/**
 * ========================================
 * 다단계 토큰 매칭 시스템
 * ========================================
 * 
 * 4단계 Progressive Token Matching:
 * Level 1: 1글자 토큰 (Character-level)
 * Level 2: 2글자 토큰 (Bigram)
 * Level 3: 3글자 토큰 (Trigram)
 * Level 4: 단어 토큰 (Word-level)
 * 
 * 각 레벨별 가중치를 적용하여 최종 점수 계산
 * 
 * @author 2026-01-30
 */

/* ================= 유틸리티 함수 ================= */

/**
 * 문자열 정규화 (공백, 특수문자 제거)
 */
function normTight(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

/**
 * N-gram 생성 함수
 * @param text 입력 텍스트
 * @param n N-gram 크기
 * @returns N-gram 배열
 * 
 * @example
 * generateNGrams("루이미셸", 2) => ["루이", "이미", "미셸"]
 * generateNGrams("샤블리", 1) => ["샤", "블", "리"]
 */
function generateNGrams(text: string, n: number): string[] {
  if (!text || text.length < n) return [];
  
  const normalized = normTight(text);
  const ngrams: string[] = [];
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.substring(i, i + n));
  }
  
  return ngrams;
}

/**
 * 단어 토큰 생성 (공백 기준 분리)
 */
function generateWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .map(t => normTight(t));
}

/* ================= 레벨별 매칭 함수 ================= */

/**
 * Level 1: Character-level 매칭 (1글자)
 * 
 * "루이미셸" vs "루이 미셸 에피"
 * → ["루", "이", "미", "셸"] vs ["루", "이", "미", "셸", "에", "피"]
 * → 4/4 매칭 = 1.0
 */
function charLevelMatch(query: string, target: string): number {
  const queryChars = generateNGrams(query, 1);
  const targetChars = generateNGrams(target, 1);
  
  if (queryChars.length === 0 || targetChars.length === 0) return 0;
  
  const querySet = new Set(queryChars);
  const targetSet = new Set(targetChars);
  
  // 교집합 개수
  const intersection = Array.from(querySet).filter(ch => targetSet.has(ch));
  
  // Recall: 쿼리 문자 중 매칭된 비율
  const recall = intersection.length / querySet.size;
  
  // Precision: 타겟 문자 중 매칭된 비율
  const precision = intersection.length / targetSet.size;
  
  // F1 Score (Recall과 Precision의 조화평균)
  if (recall + precision === 0) return 0;
  const f1 = (2 * recall * precision) / (recall + precision);
  
  return f1;
}

/**
 * Level 2: Bigram 매칭 (2글자)
 * 
 * "루이미셸" vs "루이 미셸"
 * → ["루이", "이미", "미셸"] vs ["루이", "미셸"]
 * → 2/3 매칭 = 0.67
 */
function bigramMatch(query: string, target: string): number {
  const queryBigrams = generateNGrams(query, 2);
  const targetBigrams = generateNGrams(target, 2);
  
  if (queryBigrams.length === 0 || targetBigrams.length === 0) return 0;
  
  const querySet = new Set(queryBigrams);
  const targetSet = new Set(targetBigrams);
  
  const intersection = Array.from(querySet).filter(bg => targetSet.has(bg));
  
  const recall = intersection.length / querySet.size;
  const precision = intersection.length / targetSet.size;
  
  if (recall + precision === 0) return 0;
  const f1 = (2 * recall * precision) / (recall + precision);
  
  return f1;
}

/**
 * Level 3: Trigram 매칭 (3글자)
 * 
 * "루이미셸" vs "루이미셸 에피"
 * → ["루이미", "이미셸"] vs ["루이미", "이미셸", "미셸에", "셸에피"]
 * → 2/2 매칭 = 1.0
 */
function trigramMatch(query: string, target: string): number {
  const queryTrigrams = generateNGrams(query, 3);
  const targetTrigrams = generateNGrams(target, 3);
  
  if (queryTrigrams.length === 0 || targetTrigrams.length === 0) return 0;
  
  const querySet = new Set(queryTrigrams);
  const targetSet = new Set(targetTrigrams);
  
  const intersection = Array.from(querySet).filter(tg => targetSet.has(tg));
  
  const recall = intersection.length / querySet.size;
  const precision = intersection.length / targetSet.size;
  
  if (recall + precision === 0) return 0;
  const f1 = (2 * recall * precision) / (recall + precision);
  
  return f1;
}

/**
 * Level 4: Word-level 매칭 (단어 단위)
 * 
 * "루이 미셸 샤블리" vs "루이 미셸 에피, 샤블리"
 * → ["루이", "미셸", "샤블리"] vs ["루이", "미셸", "에피", "샤블리"]
 * → 3/3 매칭 = 1.0
 * 
 * ✅ 개선: 쿼리 토큰이 모두 매칭되면 높은 점수 (recall 중심)
 */
function wordLevelMatch(query: string, target: string): number {
  const queryWords = generateWordTokens(query);
  const targetWords = generateWordTokens(target);
  
  if (queryWords.length === 0 || targetWords.length === 0) return 0;
  
  const querySet = new Set(queryWords);
  const targetSet = new Set(targetWords);
  
  let matchedQuery = 0;
  const exactMatched = new Set<string>();

  // 완전 일치 체크
  for (const qw of queryWords) {
    if (targetSet.has(qw)) {
      matchedQuery++;
      exactMatched.add(qw);
    }
  }

  // 부분 일치 체크 (완전 일치된 단어는 스킵 — 이중 카운트 방지)
  for (const qw of queryWords) {
    if (matchedQuery >= queryWords.length) break;
    if (exactMatched.has(qw)) continue;

    let found = false;
    for (const tw of targetWords) {
      if (!found && tw.includes(qw) && qw.length >= 2) {
        matchedQuery += 0.8;
        found = true;
        break;
      }
      if (!found && qw.includes(tw) && tw.length >= 2) {
        matchedQuery += 0.8;
        found = true;
        break;
      }
    }
  }
  
  // ✅ Recall 중심 점수 (쿼리 토큰 중 매칭된 비율)
  const recall = matchedQuery / queryWords.length;
  
  // 🎯 쿼리 토큰이 모두 매칭되면 높은 점수
  if (recall >= 0.95) {
    return 1.0;
  } else if (recall >= 0.85) {
    return 0.95;
  } else if (recall >= 0.75) {
    return 0.85;
  } else if (recall >= 0.65) {
    return 0.75;
  } else {
    return recall;
  }
}

/* ================= 메인 매칭 함수 ================= */

/**
 * 다단계 토큰 매칭 점수 계산
 * 
 * @param query 검색어 (예: "루이미셸 샤블리")
 * @param target 대상 품목명 (예: "루이 미셸 에피, 샤블리 그랑크뤼")
 * @param weights 레벨별 가중치 (기본값: 자동 결정)
 * @returns 0.0 ~ 1.0 사이의 매칭 점수
 * 
 * @example
 * multiLevelTokenMatch("루이미셸 샤블리", "루이 미셸 에피, 샤블리 그랑크뤼")
 * => char: 0.9, bigram: 0.85, trigram: 0.8, word: 0.95
 * => final: 0.05*0.9 + 0.15*0.85 + 0.25*0.8 + 0.55*0.95 = 0.90
 */
export function multiLevelTokenMatch(
  query: string,
  target: string,
  weights?: [number, number, number, number]
): number {
  if (!query || !target) return 0;
  
  // 각 레벨별 점수 계산
  const level1Score = charLevelMatch(query, target);
  const level2Score = bigramMatch(query, target);
  const level3Score = trigramMatch(query, target);
  const level4Score = wordLevelMatch(query, target);
  
  // 🎯 가중치 자동 결정 (짧은 쿼리 vs 긴 쿼리)
  let finalWeights: [number, number, number, number];
  
  if (weights) {
    finalWeights = weights;
  } else {
    const queryLength = normTight(query).length;
    
    if (queryLength <= 4) {
      // 짧은 쿼리 (예: "샤블리", "팔콘")
      // → Word-level 중요도 증가
      finalWeights = [0.05, 0.10, 0.20, 0.65];
    } else if (queryLength <= 8) {
      // 중간 쿼리 (예: "루이미셸", "샤블리비에유")
      // → Bigram/Trigram 중요도 증가
      finalWeights = [0.05, 0.15, 0.30, 0.50];
    } else {
      // 긴 쿼리 (예: "루이 미셸 샤블리 그랑크뤼")
      // → 모든 레벨 균형
      finalWeights = [0.05, 0.15, 0.25, 0.55];
    }
  }
  
  // 가중 평균 계산
  const finalScore = 
    level1Score * finalWeights[0] +
    level2Score * finalWeights[1] +
    level3Score * finalWeights[2] +
    level4Score * finalWeights[3];
  
  return Math.min(1.0, finalScore);
}

/**
 * 다단계 매칭 + 상세 디버그 정보 반환
 */
export interface MultiLevelMatchResult {
  score: number;
  details: {
    level1: number;  // Character-level
    level2: number;  // Bigram
    level3: number;  // Trigram
    level4: number;  // Word-level
  };
}

export function multiLevelTokenMatchWithDetails(
  query: string,
  target: string,
  weights?: [number, number, number, number]
): MultiLevelMatchResult {
  if (!query || !target) {
    return {
      score: 0,
      details: { level1: 0, level2: 0, level3: 0, level4: 0 }
    };
  }
  
  const level1 = charLevelMatch(query, target);
  const level2 = bigramMatch(query, target);
  const level3 = trigramMatch(query, target);
  const level4 = wordLevelMatch(query, target);
  
  // 🎯 가중치 자동 결정
  let finalWeights: [number, number, number, number];
  
  if (weights) {
    finalWeights = weights;
  } else {
    const queryLength = normTight(query).length;
    
    if (queryLength <= 4) {
      finalWeights = [0.05, 0.10, 0.20, 0.65];
    } else if (queryLength <= 8) {
      finalWeights = [0.05, 0.15, 0.30, 0.50];
    } else {
      finalWeights = [0.05, 0.15, 0.25, 0.55];
    }
  }
  
  const score = Math.min(1.0,
    level1 * finalWeights[0] +
    level2 * finalWeights[1] +
    level3 * finalWeights[2] +
    level4 * finalWeights[3]
  );
  
  return {
    score,
    details: {
      level1: Math.round(level1 * 1000) / 1000,
      level2: Math.round(level2 * 1000) / 1000,
      level3: Math.round(level3 * 1000) / 1000,
      level4: Math.round(level4 * 1000) / 1000,
    }
  };
}

/**
 * Pre-filtering용 빠른 매칭 (Word-level만 사용)
 * 
 * 10,000개 품목에서 빠르게 500개로 축소하기 위한 함수
 */
export function quickWordMatch(query: string, target: string): number {
  return wordLevelMatch(query, target);
}
