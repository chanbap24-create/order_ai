/**
 * ========================================
 * 검색어 확장 시스템 (Query Expander)
 * ========================================
 *
 * 학습된 토큰 매핑을 활용하여 검색어를 자동 확장
 * 예: "ch 샤도" → "찰스하이직 샤르도네"
 */

import { supabase } from "@/app/lib/db";

/* ==================== 유틸리티 ==================== */

function stripQtyAndUnit(raw: string): string {
  let s = String(raw || "").trim();
  // ✅ 단위 포함 수량 제거
  s = s.replace(/(\d+)\s*(병|박스|cs|box|bt|btl|개|잔)/gi, "").trim();
  // ✅ 슬래시/대시 뒤 숫자는 코드 일부이므로 보호 (0330/07의 07을 지우면 안됨)
  s = s.replace(/(?<![\/\-])\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function extractTokens(text: string): string[] {
  const normalized = stripQtyAndUnit(text);
  return normalized
    .split(/\s+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
}

/* ==================== 토큰 매핑 조회 ==================== */

export interface TokenMapping {
  token: string;
  mapped_text: string;
  token_type: string;
  confidence: number;
  learned_count: number;
}

/**
 * 토큰의 매핑 조회
 */
export async function getTokenMapping(token: string): Promise<TokenMapping | null> {
  try {
    const { data } = await supabase
      .from('token_mapping')
      .select('token, mapped_text, token_type, confidence, learned_count')
      .eq('token', token.toLowerCase())
      .order('confidence', { ascending: false })
      .order('learned_count', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        token: data.token,
        mapped_text: data.mapped_text,
        token_type: data.token_type,
        confidence: data.confidence,
        learned_count: data.learned_count
      };
    }

    return null;
  } catch (err) {
    console.error('[QueryExpand] 토큰 매핑 조회 실패:', err);
    return null;
  }
}

/**
 * 모든 학습된 매핑 조회 (디버깅용)
 */
export async function getAllTokenMappings(): Promise<TokenMapping[]> {
  try {
    const { data } = await supabase
      .from('token_mapping')
      .select('token, mapped_text, token_type, confidence, learned_count')
      .order('confidence', { ascending: false })
      .order('learned_count', { ascending: false });

    return (data || []).map((r: any) => ({
      token: r.token,
      mapped_text: r.mapped_text,
      token_type: r.token_type,
      confidence: r.confidence,
      learned_count: r.learned_count
    }));
  } catch (err) {
    console.error('[QueryExpand] 전체 매핑 조회 실패:', err);
    return [];
  }
}

/* ==================== 검색어 확장 ==================== */

export interface ExpandedToken {
  original: string;
  expanded: string;
  type: string;
  confidence: number;
  isExpanded: boolean;
}

export interface ExpandedQuery {
  original: string;
  expanded: string;
  tokens: ExpandedToken[];
  hasExpansion: boolean;
}

/**
 * 학습된 토큰 매핑으로 검색어 확장
 */
export async function expandQuery(rawQuery: string, minConfidence: number = 0.5): Promise<ExpandedQuery> {
  const normalized = stripQtyAndUnit(rawQuery);
  const tokens = extractTokens(normalized);

  const expandedTokens: ExpandedToken[] = [];
  let hasExpansion = false;

  for (const token of tokens) {
    const mapping = await getTokenMapping(token);

    if (mapping && mapping.confidence >= minConfidence) {
      // 매핑 발견!
      expandedTokens.push({
        original: token,
        expanded: mapping.mapped_text,
        type: mapping.token_type,
        confidence: mapping.confidence,
        isExpanded: true
      });
      hasExpansion = true;
    } else {
      // 매핑 없음, 원본 유지
      expandedTokens.push({
        original: token,
        expanded: token,
        type: 'unknown',
        confidence: 0,
        isExpanded: false
      });
    }
  }

  const expandedQuery = expandedTokens.map(t => t.expanded).join(' ');

  return {
    original: normalized,
    expanded: expandedQuery,
    tokens: expandedTokens,
    hasExpansion
  };
}

/**
 * 검색어 확장 로그 출력
 */
export function logQueryExpansion(expansion: ExpandedQuery): void {
  if (!expansion.hasExpansion) {
    console.log(`[QueryExpand] "${expansion.original}" (확장 없음)`);
    return;
  }

  console.log(`[QueryExpand] "${expansion.original}" → "${expansion.expanded}"`);
  expansion.tokens.forEach(t => {
    if (t.isExpanded) {
      console.log(`  ✨ "${t.original}" → "${t.expanded}" (${t.type}, confidence: ${t.confidence.toFixed(2)})`);
    }
  });
}

/**
 * 여러 변형 생성 (원본 + 확장 + 부분 확장)
 */
export async function generateQueryVariations(rawQuery: string): Promise<string[]> {
  const expansion = await expandQuery(rawQuery);
  const variations: string[] = [];

  // 1. 원본 검색어
  variations.push(expansion.original);

  // 2. 완전 확장 검색어
  if (expansion.hasExpansion && expansion.expanded !== expansion.original) {
    variations.push(expansion.expanded);
  }

  // 3. 부분 확장 (생산자만 또는 품종만)
  const producerTokens = expansion.tokens.filter(t => t.type === 'producer');
  const varietalTokens = expansion.tokens.filter(t => t.type === 'varietal');

  if (producerTokens.length > 0) {
    const producerExpanded = expansion.tokens.map(t =>
      t.type === 'producer' ? t.expanded : t.original
    ).join(' ');
    if (producerExpanded !== expansion.original && producerExpanded !== expansion.expanded) {
      variations.push(producerExpanded);
    }
  }

  if (varietalTokens.length > 0) {
    const varietalExpanded = expansion.tokens.map(t =>
      t.type === 'varietal' ? t.expanded : t.original
    ).join(' ');
    if (varietalExpanded !== expansion.original && varietalExpanded !== expansion.expanded) {
      variations.push(varietalExpanded);
    }
  }

  // 중복 제거
  return Array.from(new Set(variations));
}
