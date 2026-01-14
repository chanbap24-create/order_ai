/**
 * ========================================
 * 자연어 전처리 시스템
 * ========================================
 * 
 * item_alias 테이블을 활용한 별칭 자동 확장
 * 사용자 입력을 정규화하여 매칭률 향상
 */

import { db } from "@/app/lib/db";

// 별칭 캐시 (성능 최적화)
let aliasCache: Map<string, string> | null = null;
let aliasCacheTimestamp = 0;
const CACHE_TTL = 60000; // 1분

// 별칭 캐시 로드
function loadAliasCache(): Map<string, string> {
  const now = Date.now();
  
  // 캐시가 유효하면 재사용
  if (aliasCache && (now - aliasCacheTimestamp) < CACHE_TTL) {
    return aliasCache;
  }
  
  // 캐시 갱신
  try {
    const aliases = db.prepare(`
      SELECT alias, canonical
      FROM item_alias
      ORDER BY count DESC
    `).all() as Array<{ alias: string; canonical: string }>;
    
    aliasCache = new Map();
    aliases.forEach(a => {
      aliasCache!.set(a.alias.toLowerCase(), a.canonical);
    });
    
    aliasCacheTimestamp = now;
    return aliasCache;
  } catch (e) {
    console.error('별칭 캐시 로드 실패:', e);
    return new Map();
  }
}

// 별칭 확장
export function expandAliases(text: string): string {
  const aliases = loadAliasCache();
  let expanded = text;
  
  // 1. 정확한 단어 매칭 (공백/특수문자로 분리된 경우)
  const words = text.split(/(\s+|[,()\/\-])/);
  const expandedWords = words.map(word => {
    const lowerWord = word.toLowerCase();
    if (aliases.has(lowerWord)) {
      return aliases.get(lowerWord)!;
    }
    return word;
  });
  
  expanded = expandedWords.join('');
  
  // 2. 부분 매칭 (붙어있는 경우 대응) - 성능 최적화
  // 별칭이 긴 것부터 순서대로 치환 (긴 것이 우선)
  // 3글자 이상이고 사용 빈도 5회 이상인 것만 처리
  const sortedAliases = Array.from(aliases.entries())
    .filter(([alias]) => alias.length >= 3)  // 최소 3글자
    .sort((a, b) => b[0].length - a[0].length)  // 긴 것 우선
    .slice(0, 50);  // 상위 50개만 (성능 최적화)
  
  const lowerExpanded = expanded.toLowerCase();
  
  for (const [alias, canonical] of sortedAliases) {
    if (lowerExpanded.includes(alias)) {
      // 대소문자 구분 없이 치환
      const regex = new RegExp(alias, 'gi');
      expanded = expanded.replace(regex, ` ${canonical} `);
    }
  }
  
  // 3. 연속된 공백 정리
  expanded = expanded.replace(/\s+/g, ' ').trim();
  
  return expanded;
}

// 수량 표현 정규화
export function normalizeQuantity(text: string): string {
  let normalized = text;
  
  // 한글 숫자 변환
  const koreanNumbers: Record<string, string> = {
    '한': '1',
    '두': '2',
    '세': '3',
    '네': '4',
    '다섯': '5',
    '여섯': '6',
    '일곱': '7',
    '여덟': '8',
    '아홉': '9',
    '열': '10',
  };
  
  for (const [kor, num] of Object.entries(koreanNumbers)) {
    normalized = normalized.replace(new RegExp(kor + '\\s*(병|케이스|박스)', 'g'), `${num}$1`);
  }
  
  // 단위 정규화
  normalized = normalized.replace(/케이스/g, 'cs');
  normalized = normalized.replace(/박스/g, 'cs');
  normalized = normalized.replace(/개/g, '병');
  
  return normalized;
}

// 와인 용어 정규화
export function normalizeWineTerms(text: string): string {
  let normalized = text.toLowerCase();
  
  // 품종 약어 확장
  const varietalMap: Record<string, string> = {
    '샤도': '샤르도네',
    '까베': '카베르네',
    '소비': '소비뇽',
    '피노': '피노누아',
    '메를': '메를로',
  };
  
  for (const [abbr, full] of Object.entries(varietalMap)) {
    const regex = new RegExp(abbr, 'g');
    normalized = normalized.replace(regex, full);
  }
  
  // 영문 품종 한글화
  const englishVarietalMap: Record<string, string> = {
    'chardonnay': '샤르도네',
    'chard': '샤르도네',
    'cabernet': '카베르네',
    'cab': '카베르네',
    'sauvignon': '소비뇽',
    'sauv': '소비뇽',
    'pinot noir': '피노누아',
    'pinot': '피노',
    'merlot': '메를로',
    'riesling': '리슬링',
  };
  
  for (const [en, kr] of Object.entries(englishVarietalMap)) {
    const regex = new RegExp('\\b' + en + '\\b', 'gi');
    normalized = normalized.replace(regex, kr);
  }
  
  // 와인 타입
  normalized = normalized.replace(/\bbrut\b/gi, '브륏');
  normalized = normalized.replace(/\bdry\b/gi, '드라이');
  normalized = normalized.replace(/\bsweet\b/gi, '스위트');
  normalized = normalized.replace(/\bred\b/gi, '레드');
  normalized = normalized.replace(/\bwhite\b/gi, '화이트');
  normalized = normalized.replace(/\brose\b/gi, '로제');
  
  return normalized;
}

// 생산자명 정규화
export function normalizeProducers(text: string): string {
  let normalized = text;
  
  // 자주 쓰이는 생산자 약어
  const producerMap: Record<string, string> = {
    'ch': '샤또',
    'dom': '도멘',
    'domaine': '도멘',
    'chateau': '샤또',
    'maison': '메종',
  };
  
  // 단어 경계에서만 치환
  for (const [abbr, full] of Object.entries(producerMap)) {
    const regex = new RegExp('\\b' + abbr + '\\b', 'gi');
    normalized = normalized.replace(regex, full);
  }
  
  return normalized;
}

// 불필요한 표현 제거
export function removeFluff(text: string): string {
  let cleaned = text;
  
  // 인사말
  cleaned = cleaned.replace(/안녕하세요\.?|안녕하십니까\.?/g, ' ');
  
  // 요청 표현
  cleaned = cleaned.replace(/(부탁드려요|부탁드립니다|부탁해요|주세요|주문합니다|주문드려요|주문드립니다)\.?/g, ' ');
  
  // 감사 표현
  cleaned = cleaned.replace(/(감사합니다|고맙습니다|고맙습니다요|감사해요)\.?/g, ' ');
  
  // 종결어미
  cleaned = cleaned.replace(/(입니다|요)\.?/g, ' ');
  
  // 여러 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// 통합 전처리 함수
export function preprocessNaturalLanguage(text: string): string {
  let processed = text;
  
  // 1. 불필요한 표현 제거
  processed = removeFluff(processed);
  
  // 2. 별칭 확장 (가장 먼저!)
  processed = expandAliases(processed);
  
  // 3. 수량 표현 정규화
  processed = normalizeQuantity(processed);
  
  // 4. 와인 용어 정규화
  processed = normalizeWineTerms(processed);
  
  // 5. 생산자명 정규화
  processed = normalizeProducers(processed);
  
  return processed;
}

// 전처리 결과 디버그
export interface PreprocessResult {
  original: string;
  processed: string;
  steps: Array<{
    step: string;
    result: string;
  }>;
}

export function preprocessWithDebug(text: string): PreprocessResult {
  const steps: Array<{ step: string; result: string }> = [];
  
  let current = text;
  steps.push({ step: '0. 원본', result: current });
  
  current = removeFluff(current);
  steps.push({ step: '1. 불필요한 표현 제거', result: current });
  
  current = expandAliases(current);
  steps.push({ step: '2. 별칭 확장', result: current });
  
  current = normalizeQuantity(current);
  steps.push({ step: '3. 수량 정규화', result: current });
  
  current = normalizeWineTerms(current);
  steps.push({ step: '4. 와인 용어 정규화', result: current });
  
  current = normalizeProducers(current);
  steps.push({ step: '5. 생산자명 정규화', result: current });
  
  return {
    original: text,
    processed: current,
    steps,
  };
}
