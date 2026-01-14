/**
 * ========================================
 * 토큰 기반 품목 검색 시스템
 * ========================================
 * 
 * token_mapping 테이블을 활용한 자연어 검색
 * 학습된 토큰으로 품목을 빠르게 매칭
 */

import { db } from "@/app/lib/db";

// 한글 초성 추출
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㄹ', 'ㅁ', 'ㅂ', 
  'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

function extractConsonants(str: string): string {
  const result = [];
  for (const ch of str) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const chosungIndex = Math.floor(code / 588);
      result.push(CHOSUNG[chosungIndex]);
    }
  }
  return result.join('');
}

// 토큰 추출 함수
export function extractTokens(text: string): string[] {
  const tokens = new Set<string>();
  
  // 1. 공백 기준 분리
  const words = text.toLowerCase().split(/[\s,]+/);
  words.forEach(w => {
    if (w.length >= 2) tokens.add(w);
  });
  
  // 2. 한글 초성 (3글자 이상)
  if (/[가-힣]{3,}/.test(text)) {
    const korean = text.match(/[가-힣]+/g);
    if (korean) {
      korean.forEach(k => {
        if (k.length >= 3) {
          const chosung = extractConsonants(k);
          if (chosung.length >= 2) {
            tokens.add(chosung);
          }
        }
      });
    }
  }
  
  // 3. 약어 추출 (대문자 2-4글자)
  const abbrs = text.match(/\b[A-Z]{2,4}\b/g);
  if (abbrs) {
    abbrs.forEach(a => tokens.add(a.toLowerCase()));
  }
  
  return Array.from(tokens);
}

// 토큰 매핑 결과 타입
export interface TokenMatch {
  item_no: string;
  token: string;
  token_type: string;
  confidence: number;
  learned_count: number;
}

// 토큰으로 품목 검색
export function searchByToken(token: string): TokenMatch[] {
  try {
    const matches = db.prepare(`
      SELECT 
        mapped_text as item_no,
        token,
        token_type,
        confidence,
        learned_count
      FROM token_mapping
      WHERE token = ? COLLATE NOCASE
      ORDER BY learned_count DESC
    `).all(token) as TokenMatch[];
    
    return matches;
  } catch (e) {
    console.error(`토큰 검색 실패: ${token}`, e);
    return [];
  }
}

// 여러 토큰으로 품목 검색
export function searchByTokens(query: string): Map<string, TokenMatch[]> {
  const tokens = extractTokens(query);
  const results = new Map<string, TokenMatch[]>();
  
  for (const token of tokens) {
    const matches = searchByToken(token);
    if (matches.length > 0) {
      results.set(token, matches);
    }
  }
  
  return results;
}

// 토큰 매칭 점수 집계
export interface AggregatedMatch {
  item_no: string;
  matchedTokens: string[];
  totalScore: number;
  avgConfidence: number;
  avgLearnedCount: number;
}

export function aggregateTokenMatches(tokenMatches: Map<string, TokenMatch[]>): AggregatedMatch[] {
  const itemScores = new Map<string, {
    tokens: Set<string>;
    scores: number[];
    confidences: number[];
    learnedCounts: number[];
  }>();
  
  // 1. 토큰별 매칭 결과 집계
  for (const [token, matches] of tokenMatches.entries()) {
    for (const match of matches) {
      if (!itemScores.has(match.item_no)) {
        itemScores.set(match.item_no, {
          tokens: new Set(),
          scores: [],
          confidences: [],
          learnedCounts: [],
        });
      }
      
      const item = itemScores.get(match.item_no)!;
      item.tokens.add(token);
      item.scores.push(match.confidence);
      item.confidences.push(match.confidence);
      item.learnedCounts.push(match.learned_count);
    }
  }
  
  // 2. 집계 및 정렬
  const aggregated: AggregatedMatch[] = [];
  
  for (const [item_no, data] of itemScores.entries()) {
    const matchedTokens = Array.from(data.tokens);
    const totalScore = data.scores.reduce((sum, s) => sum + s, 0);
    const avgConfidence = data.confidences.reduce((sum, c) => sum + c, 0) / data.confidences.length;
    const avgLearnedCount = data.learnedCounts.reduce((sum, l) => sum + l, 0) / data.learnedCounts.length;
    
    aggregated.push({
      item_no,
      matchedTokens,
      totalScore,
      avgConfidence,
      avgLearnedCount,
    });
  }
  
  // 3. 정렬 (매칭된 토큰 수 > 총점 > 학습 빈도)
  aggregated.sort((a, b) => {
    if (a.matchedTokens.length !== b.matchedTokens.length) {
      return b.matchedTokens.length - a.matchedTokens.length;
    }
    if (a.totalScore !== b.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return b.avgLearnedCount - a.avgLearnedCount;
  });
  
  return aggregated;
}

// 토큰 기반 검색 (통합)
export function tokenBasedSearch(query: string): AggregatedMatch[] {
  const tokenMatches = searchByTokens(query);
  return aggregateTokenMatches(tokenMatches);
}

// 토큰 매칭 부스트 점수 계산
export function calculateTokenBoost(query: string, itemNo: string): number {
  const tokenMatches = searchByTokens(query);
  
  for (const [token, matches] of tokenMatches.entries()) {
    for (const match of matches) {
      if (match.item_no === itemNo) {
        // 학습 빈도에 따라 부스트 점수 계산
        const frequencyBoost = Math.min(match.learned_count * 0.01, 0.10); // 최대 0.10
        const baseBoost = 0.10; // 기본 부스트
        return baseBoost + frequencyBoost;
      }
    }
  }
  
  return 0;
}
