// app/lib/orderReviewer.ts
// 1차 LLM 매칭 결과를 로컬 규칙으로 한 번 더 검수.
// 추가 LLM 호출 없음 — 비용 0.
//
// 검수 기준:
//   - query(원본 발주문)에서 핵심 키워드 추출
//   - item_alias DB로 약어/별칭 확장 (예: VG → 뱅상 지라르댕)
//   - 각 후보의 item_name과 키워드 overlap 계산
//   - 거래처 입고 이력 가중치
//   - reviewed score = LLM confidence + 키워드 overlap * 0.2 + history * 0.08
//   - 1순위가 아닌 후보의 reviewed가 1순위보다 0.10 이상 높으면 swap

import { supabase } from "@/app/lib/db";

interface ReviewerCandidate {
  item_no: string;
  item_name: string;
  confidence: number;
  reasoning?: string;
  [key: string]: unknown;
}

interface ReviewerOrderLine {
  query: string;
  quantity: number;
  candidates: ReviewerCandidate[];
  review_note?: string;
  [key: string]: unknown;
}

// ────────────────────────────────────────────────
// item_alias DB 캐시 (5분 TTL)
// canonical은 두 가지 형식이 섞여 있음:
//   - 품번 (예: "3021701", "3A24403") — 후보 item_no와 직접 매칭
//   - 텍스트 (예: "로쏘 디 몬탈치노") — 후보 item_name에 substring 매칭
// ────────────────────────────────────────────────
type AliasMap = {
  /** alias 텍스트(lower) → canonical 원본 */
  byAlias: Map<string, string>;
  /** alias 리스트 (긴 것부터 정렬, query substring 매칭용) */
  aliasesSorted: string[];
};

let aliasCache: AliasMap | null = null;
let aliasCacheTs = 0;
const ALIAS_CACHE_TTL = 5 * 60 * 1000;

/** 품번 형식인지 판별 — 영숫자 6~8자 (예: 3021701, 3A24403, D792003) */
function isItemNoFormat(s: string): boolean {
  return /^[A-Za-z0-9]{6,8}$/.test(s.trim());
}

async function getAliasMap(): Promise<AliasMap> {
  if (aliasCache && Date.now() - aliasCacheTs < ALIAS_CACHE_TTL) {
    return aliasCache;
  }
  try {
    const { data } = await supabase.from("item_alias").select("alias, canonical");
    const byAlias = new Map<string, string>();
    for (const row of (data || []) as { alias: string; canonical: string }[]) {
      if (row.alias && row.canonical) {
        byAlias.set(row.alias.toLowerCase().trim(), row.canonical.trim());
      }
    }
    const aliasesSorted = Array.from(byAlias.keys()).sort(
      (a, b) => b.length - a.length,
    );
    const result: AliasMap = { byAlias, aliasesSorted };
    aliasCache = result;
    aliasCacheTs = Date.now();
    return result;
  } catch {
    return aliasCache || { byAlias: new Map(), aliasesSorted: [] };
  }
}

/**
 * query 텍스트에 포함된 모든 alias의 canonical을 수집.
 * 긴 alias부터 매칭해서 부분 alias로 인한 오매칭 방지.
 *
 * 2글자 alias(예: "샤도")는 다른 와인명에 우연히 부분 포함될 확률이 크므로
 * 별도 "weak" 집합으로 분리해 가중치를 낮춘다 (false positive 방어).
 */
const SHORT_ALIAS_LEN = 2; // 2글자 = weak, 3글자+ = strong

function findAliasHits(
  query: string,
  aliasMap: AliasMap,
): {
  strongItemNos: Set<string>;
  weakItemNos: Set<string>;
  strongNames: string[];
  weakNames: string[];
} {
  const q = (query || "").toLowerCase();
  const strongItemNos = new Set<string>();
  const weakItemNos = new Set<string>();
  const strongNames: string[] = [];
  const weakNames: string[] = [];
  if (!q) return { strongItemNos, weakItemNos, strongNames, weakNames };
  for (const alias of aliasMap.aliasesSorted) {
    if (alias.length < 2) continue;
    if (!q.includes(alias)) continue;
    const canonical = aliasMap.byAlias.get(alias);
    if (!canonical) continue;
    const isWeak = alias.length <= SHORT_ALIAS_LEN;
    if (isItemNoFormat(canonical)) {
      (isWeak ? weakItemNos : strongItemNos).add(canonical.toUpperCase());
    } else {
      (isWeak ? weakNames : strongNames).push(canonical.toLowerCase());
    }
  }
  return { strongItemNos, weakItemNos, strongNames, weakNames };
}

// ────────────────────────────────────────────────
// query에서 핵심 키워드 추출
// 수량/단위/색상 표현 제거, 2글자 이상만 남김
// ────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "병", "개", "잔", "박스", "케이스", "주세요", "부탁", "발주", "요청",
  "그리고", "또는", "하고", "한", "두", "세", "네",
]);

function extractKeywords(query: string): string[] {
  let q = (query || "").toLowerCase();
  // "N병/N개/N잔" 같은 수량 패턴 제거
  q = q.replace(/\d+\s*(병|개|잔|박스|케이스|btl|btls)/g, " ");
  // 단독 숫자 (수량/빈티지) 제거
  q = q.replace(/\b\d+\b/g, " ");
  // 구두점/특수문자 제거
  q = q.replace(/[/,()\-_·•・|\\\[\]{}"']/g, " ");
  // 공백 split, 2글자 이상, 불용어 제외
  return q
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

// ────────────────────────────────────────────────
// 키워드 overlap (0~1)
// item_name에 query 키워드가 얼마나 직접 포함되는지
// (alias 매칭은 별도 findAliasHits에서 처리)
// ────────────────────────────────────────────────
function keywordOverlap(queryKeywords: string[], itemName: string): number {
  if (queryKeywords.length === 0) return 0;
  const name = (itemName || "").toLowerCase();
  let hit = 0;
  for (const kw of queryKeywords) {
    if (kw && name.includes(kw)) hit++;
  }
  return hit / queryKeywords.length;
}

// ────────────────────────────────────────────────
// public: 라인들을 한 번에 검수
// ────────────────────────────────────────────────
export interface ReviewResult<T extends ReviewerOrderLine> {
  lines: T[];
  swapCount: number;
  warnCount: number;
}

export async function reviewOrderLines<T extends ReviewerOrderLine>(
  orderLines: T[],
  historySet: Set<string>,
): Promise<ReviewResult<T>> {
  const aliasMap = await getAliasMap();
  let swapCount = 0;
  let warnCount = 0;

  for (const line of orderLines) {
    if (!line.candidates || line.candidates.length === 0) continue;

    const queryKeywords = extractKeywords(line.query || "");
    const aliasHits = findAliasHits(line.query || "", aliasMap);
    const hasStrongAlias =
      aliasHits.strongItemNos.size > 0 || aliasHits.strongNames.length > 0;
    const hasWeakAlias =
      aliasHits.weakItemNos.size > 0 || aliasHits.weakNames.length > 0;
    const hasAliasMatch = hasStrongAlias || hasWeakAlias;

    if (queryKeywords.length === 0 && !hasAliasMatch) continue;

    // 각 후보에 reviewed score 계산
    const scored = line.candidates.map((c, idx) => {
      const itemNo = (c.item_no || "").trim().toUpperCase();
      const name = (c.item_name || "").toLowerCase();
      const overlap = keywordOverlap(queryKeywords, c.item_name || "");
      const inHistory = historySet.has(itemNo);

      // alias 매칭 — strong(3글자+)는 압도적, weak(2글자)는 false positive 가능성 있어 약하게
      const aliasStrong =
        aliasHits.strongItemNos.has(itemNo) ||
        aliasHits.strongNames.some((n) => name.includes(n));
      const aliasWeak =
        aliasHits.weakItemNos.has(itemNo) ||
        aliasHits.weakNames.some((n) => name.includes(n));
      const aliasHit = aliasStrong || aliasWeak;
      const aliasItemNoHit =
        aliasHits.strongItemNos.has(itemNo) || aliasHits.weakItemNos.has(itemNo);
      const aliasBonus = aliasStrong ? 0.45 : aliasWeak ? 0.2 : 0;

      const baseConfidence = Number(c.confidence) || 0;
      const reviewed =
        baseConfidence +
        aliasBonus + // alias 매칭 (strong/weak 차등)
        0.2 * overlap + // 키워드 overlap
        (inHistory ? 0.08 : 0); // 입고 이력
      return { idx, reviewed, overlap, inHistory, aliasHit, aliasStrong, aliasItemNoHit };
    });

    // reviewed 가장 높은 후보 찾기
    const sorted = [...scored].sort((a, b) => b.reviewed - a.reviewed);
    const top = sorted[0];
    const origTop = scored[0]; // 원래 1순위

    // 케이스 A: strong alias 히트가 있는 후보가 1순위가 아니면 강제 swap (margin 무시)
    // weak alias(2글자)는 false positive 가능성 있어 케이스 B의 margin 검증을 거침
    if (top.idx !== 0 && top.aliasStrong && !origTop.aliasStrong) {
      const swapped = line.candidates[top.idx];
      line.candidates.splice(top.idx, 1);
      line.candidates.unshift(swapped);

      const reason = top.aliasItemNoHit
        ? "별칭 DB 직접 매칭"
        : "별칭 이름 매칭";
      line.review_note = `검수: 1순위 변경 (${reason})`;
      swapped.reasoning = (swapped.reasoning || "") + ` [검수: ${reason}]`;
      swapCount++;
      continue;
    }

    // 케이스 B: 일반 swap — reviewed margin이 충분히 클 때
    const swapMargin = top.reviewed - origTop.reviewed;
    if (top.idx !== 0 && swapMargin > 0.1) {
      const swapped = line.candidates[top.idx];
      line.candidates.splice(top.idx, 1);
      line.candidates.unshift(swapped);

      const reasons: string[] = [];
      if (top.aliasHit) reasons.push("별칭 매칭");
      if (top.overlap > 0.5) reasons.push(`키워드 ${Math.round(top.overlap * 100)}%`);
      if (top.inHistory) reasons.push("이전 구매");
      const reason = reasons.length > 0 ? reasons.join(" + ") : "재점수 결과";
      line.review_note = `검수: 1순위 변경 (${reason})`;
      swapped.reasoning = (swapped.reasoning || "") + ` [검수: ${reason}]`;
      swapCount++;
      continue;
    }

    // 케이스 C: strong alias 매핑이 있는데 어느 후보도 매칭 안 됨 → 의심
    // (weak alias 단독은 false positive 가능성 때문에 워닝 트리거 안 함)
    if (hasStrongAlias && !sorted.some((s) => s.aliasStrong)) {
      const aliasCount =
        aliasHits.strongItemNos.size + aliasHits.strongNames.length;
      line.review_note = `⚠ 별칭(${aliasCount}개)이 후보에 없음`;
      warnCount++;
      continue;
    }

    // 케이스 D: 1순위 유지지만 키워드 overlap이 너무 낮음 → 의심 표시
    if (
      top.idx === 0 &&
      origTop.overlap < 0.3 &&
      !origTop.aliasHit &&
      (line.candidates[0].confidence || 0) < 0.8
    ) {
      line.review_note = `⚠ 키워드 매칭 ${Math.round(origTop.overlap * 100)}% — 후보 확인 권장`;
      warnCount++;
    }
  }

  return { lines: orderLines, swapCount, warnCount };
}
