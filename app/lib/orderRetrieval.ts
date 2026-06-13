// 발주 후보 사전축소 (Phase 2b).
// 전체 카탈로그 대신 발주문 관련 품목만 LLM에 전달.
//
// 합집합(재현율 안전망):
//   1) 임베딩 의미검색(라인별 top-K)  — 약어·오타·색상·품종 변형
//   2) 토큰/모델번호 substring 매칭     — 정확 토큰·글라스 모델번호(임베딩 약점)
//   3) 거래처 입고이력                  — 재주문
//   4) 학습된 별칭 canonical            — 정정 학습 반영(후보에 강제 포함)
//   → 너무 작거나 실패하면 null 반환 → 호출 측이 전체 카탈로그로 fallback(회귀 불가)
//
// 플래그: ORDER_RETRIEVAL=on 일 때만 동작. VOYAGE_API_KEY 없으면 비활성.

import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { embedTexts } from "@/app/lib/embeddings";

export type Tab = "CDV" | "DL";
export interface OrderableWine { item_no: string; item_name: string }

const EMB_K = 25;      // 라인당 임베딩 top-K
const TOKEN_M = 15;    // 라인당 토큰매칭 최대
const MIN_UNION = 10;  // 이보다 작으면 fallback

const STOP = new Set(["병", "개", "잔", "박스", "케이스", "주세요", "부탁", "발주", "요청", "그리고", "또는", "하고"]);

export function isRetrievalEnabled(): boolean {
  return process.env.ORDER_RETRIEVAL === "on" && !!process.env.VOYAGE_API_KEY;
}

/** 발주문 → 라인(품목) 분할. 카톡 발주는 보통 1줄=1품목. */
function splitLines(orderText: string): string[] {
  return (orderText || "")
    .split(/[\n,·]+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
}

/** 라인 → 매칭 토큰(수량/단위 제거, 2글자+ , 모델번호 XXXX/XX 포함) */
function lineTokens(line: string): string[] {
  let q = line.toLowerCase();
  const models = q.match(/\d{3,4}\/\d{1,3}[a-z]?/g) || [];
  q = q.replace(/\d+\s*(병|개|잔|박스|케이스|btl|btls|cs|p)\b/g, " ");
  q = q.replace(/[()·•|\\[\]{}"'%]/g, " ");
  const toks = q.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t));
  return [...new Set([...toks, ...models])];
}

/** 토큰 substring 매칭으로 후보 보강 (생산자명·모델번호 등 임베딩이 놓치는 것) */
function addTokenMatches(set: Set<string>, lines: string[], wines: OrderableWine[]): void {
  const lower = wines.map((w) => ({ w, name: (w.item_name || "").toLowerCase() }));
  for (const line of lines) {
    const toks = lineTokens(line);
    if (toks.length === 0) continue;
    const scored: Array<{ no: string; hits: number }> = [];
    for (const { w, name } of lower) {
      let hits = 0;
      for (const t of toks) if (name.includes(t)) hits++;
      if (hits > 0) scored.push({ no: w.item_no, hits });
    }
    scored.sort((a, b) => b.hits - a.hits);
    for (const s of scored.slice(0, TOKEN_M)) set.add(s.no.toUpperCase());
  }
}

/** 학습된 별칭(item_alias) 중 발주문에 등장하는 것의 canonical(품번) 강제 포함 */
async function addLearnedAliases(set: Set<string>, orderText: string): Promise<void> {
  try {
    const { data } = await supabase.from("item_alias").select("alias, canonical").limit(2000);
    const q = (orderText || "").toLowerCase();
    for (const row of (data || []) as { alias: string; canonical: string }[]) {
      const a = (row.alias || "").toLowerCase().trim();
      if (a && a.length >= 2 && q.includes(a) && /^[a-z0-9]{6,8}$/i.test((row.canonical || "").trim())) {
        set.add(row.canonical.trim().toUpperCase());
      }
    }
  } catch { /* 별칭 없으면 무시 */ }
}

/**
 * 후보 품번 집합 반환. 비활성/실패/너무 작으면 null → 전체 카탈로그 fallback.
 */
export async function retrieveCandidateItemNos(params: {
  orderText: string;
  tab: Tab;
  orderableWines: OrderableWine[];
  historyItemNos: string[];
}): Promise<Set<string> | null> {
  const { orderText, tab, orderableWines, historyItemNos } = params;
  if (!isRetrievalEnabled()) return null;

  try {
    const lines = splitLines(orderText);
    if (lines.length === 0) return null;

    const set = new Set<string>();

    // 1) 임베딩 의미검색 — 모델번호(XXXX/XX) 없는 라인만.
    //    글라스 모델번호는 의미검색이 노이즈(글라스끼리 다 유사)라 후보가 폭증하고 느림 →
    //    모델 라인은 임베딩 건너뛰고 토큰매칭(정확)만 사용. (임베딩 호출도 절약)
    const semanticLines = lines.filter((l) => !/\d{3,4}\/\d{1,3}/.test(l));
    if (semanticLines.length > 0) {
      const vectors = await embedTexts(semanticLines, "query");
      for (let i = 0; i < semanticLines.length; i++) {
        const { data, error } = await supabase.rpc("match_items", {
          p_tab: tab,
          p_query: `[${vectors[i].join(",")}]`,
          p_k: EMB_K,
        });
        if (error) throw new Error(`match_items: ${error.message}`);
        for (const d of (data || []) as { item_no: string }[]) set.add((d.item_no || "").toUpperCase());
      }
    }

    // 2) 토큰/모델번호 매칭 (전체 라인 — 모델 라인은 여기서 정확히 잡힘)
    addTokenMatches(set, lines, orderableWines);
    // 3) 입고이력
    for (const no of historyItemNos) set.add((no || "").trim().toUpperCase());
    // 4) 학습 별칭
    await addLearnedAliases(set, orderText);

    // orderable 과 교집합 (임베딩은 비상품도 반환 가능 → 발주가능만)
    const orderableSet = new Set(orderableWines.map((w) => w.item_no.toUpperCase()));
    const filtered = new Set([...set].filter((no) => orderableSet.has(no)));

    // 모델번호(글라스 XXXX/XX)가 있으면 토큰 매칭이 정확하므로 소수 후보도 신뢰.
    // → 전체 카탈로그(1002개) 폴백을 피해 입력을 크게 줄임(속도·비용↑).
    const hasModel = lines.some((l) => /\d{3,4}\/\d{1,3}/.test(l));
    const minUnion = hasModel ? 1 : MIN_UNION; // 모델 정확매칭은 1개여도 정답
    if (filtered.size < minUnion) {
      logger.warn(`[Retrieval] union too small (${filtered.size}) → full catalog`);
      return null;
    }
    logger.info(`[Retrieval] ${tab} lines=${lines.length} candidates=${filtered.size}/${orderableWines.length}`);
    return filtered;
  } catch (e) {
    logger.warn(`[Retrieval] failed → full catalog: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
