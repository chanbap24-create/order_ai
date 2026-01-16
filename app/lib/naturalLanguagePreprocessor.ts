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
let reverseAliasCache: Map<string, string[]> | null = null; // 역방향 별칭
let aliasCacheTimestamp = 0;
const CACHE_TTL = 60000; // 1분

// 별칭 캐시 로드 (양방향)
function loadAliasCache(): { 
  forward: Map<string, string>; 
  reverse: Map<string, string[]> 
} {
  const now = Date.now();
  
  // 캐시가 유효하면 재사용
  if (aliasCache && reverseAliasCache && (now - aliasCacheTimestamp) < CACHE_TTL) {
    return { forward: aliasCache, reverse: reverseAliasCache };
  }
  
  // 캐시 갱신
  try {
    const aliases = db.prepare(`
      SELECT alias, canonical
      FROM item_alias
      ORDER BY count DESC
    `).all() as Array<{ alias: string; canonical: string }>;
    
    // 정방향: alias → canonical (기존)
    aliasCache = new Map();
    aliases.forEach(a => {
      aliasCache!.set(a.alias.toLowerCase(), a.canonical);
    });
    
    // 역방향: canonical → [alias1, alias2, ...]
    reverseAliasCache = new Map();
    aliases.forEach(a => {
      const canonicalLower = a.canonical.toLowerCase();
      if (!reverseAliasCache!.has(canonicalLower)) {
        reverseAliasCache!.set(canonicalLower, []);
      }
      reverseAliasCache!.get(canonicalLower)!.push(a.alias.toLowerCase());
    });
    
    aliasCacheTimestamp = now;
    return { forward: aliasCache, reverse: reverseAliasCache };
  } catch (e) {
    console.error('별칭 캐시 로드 실패:', e);
    return { forward: new Map(), reverse: new Map() };
  }
}

// 별칭 확장 (양방향)
export function expandAliases(text: string, debug = false): string {
  const { forward: aliases, reverse: reverseAliases } = loadAliasCache();
  let expanded = text;
  
  if (debug) console.log('[별칭 확장] 입력:', text);
  if (debug) console.log('[별칭 확장] 정방향 캐시:', aliases.size, '역방향 캐시:', reverseAliases.size);
  
  // 1. 정방향 매칭: alias → canonical (vg → 뱅상 지라르댕)
  const words = text.split(/(\s+|[,()\/\-])/);
  const expandedWords = words.map(word => {
    const lowerWord = word.toLowerCase();
    if (aliases.has(lowerWord)) {
      if (debug) console.log(`[별칭 확장] 정방향: "${word}" → "${aliases.get(lowerWord)!}"`);
      return aliases.get(lowerWord)!;
    }
    return word;
  });
  
  expanded = expandedWords.join('');
  if (debug) console.log('[별칭 확장] 1단계 결과 (정방향):', expanded);
  
  // 2. 역방향 매칭: canonical → alias (뱅상 지라르댕 → vg도 추가)
  // 입력에 정식명칭이 있으면 약어도 함께 검색하도록
  const lowerExpanded = expanded.toLowerCase();
  const wordsToAdd: string[] = [];
  
  for (const [canonical, aliasesList] of reverseAliases.entries()) {
    const normalizedCanonical = canonical.replace(/\s+/g, '');
    const normalizedExpanded = lowerExpanded.replace(/\s+/g, '');
    
    // 정식명칭이 포함되어 있으면 약어 추가
    if (normalizedExpanded.includes(normalizedCanonical) || 
        lowerExpanded.includes(canonical)) {
      // 가장 짧은 별칭 선택 (보통 약어)
      const shortestAlias = aliasesList.sort((a, b) => a.length - b.length)[0];
      if (debug) console.log(`[별칭 확장] 역방향: "${canonical}" → "+${shortestAlias}"`);
      wordsToAdd.push(shortestAlias);
    }
  }
  
  // 약어 추가 (공백으로 구분)
  if (wordsToAdd.length > 0) {
    expanded = expanded + ' ' + wordsToAdd.join(' ');
    if (debug) console.log('[별칭 확장] 역방향 추가:', wordsToAdd);
  }
  
  if (debug) console.log('[별칭 확장] 2단계 결과 (역방향):', expanded);
  
  // 3. 부분 매칭 (붙어있는 경우 대응) - 정방향만
  const sortedAliases = Array.from(aliases.entries())
    .filter(([alias]) => alias.length >= 3)  // 최소 3글자
    .sort((a, b) => b[0].length - a[0].length)  // 긴 것 우선
    .slice(0, 100);  // 상위 100개
  
  const normalizedExpanded = lowerExpanded.replace(/\s+/g, '');
  
  for (const [alias, canonical] of sortedAliases) {
    const normalizedAlias = alias.replace(/\s+/g, '');
    
    // 1) 공백 무시 매칭 (예: "클레멍라발레" = "클레멍 라발리")
    if (normalizedExpanded.includes(normalizedAlias)) {
      if (debug) console.log(`[별칭 확장] 부분 매칭 (공백무시): "${alias}" → "${canonical}"`);
      const regex = new RegExp(alias.replace(/\s+/g, '\\s*'), 'gi');
      expanded = expanded.replace(regex, ` ${canonical} `);
    }
    // 2) 기존 방식 (공백 포함 정확 매칭)
    else if (lowerExpanded.includes(alias)) {
      if (debug) console.log(`[별칭 확장] 부분 매칭 (정확): "${alias}" → "${canonical}"`);
      const regex = new RegExp(alias, 'gi');
      expanded = expanded.replace(regex, ` ${canonical} `);
    }
  }
  
  // 4. 연속된 공백 정리
  expanded = expanded.replace(/\s+/g, ' ').trim();
  
  if (debug) console.log('[별칭 확장] 최종 결과:', expanded);
  
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
