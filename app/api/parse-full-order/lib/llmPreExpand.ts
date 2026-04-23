import { expandQueriesBatch } from "@/app/lib/llmReranker";

/**
 * 짧은 약어 / 한글 2~3자 / 토큰별 짧은 항목을 LLM 배치 호출로 사전 확장.
 * parsedItems에 _llmExpanded/_originalName/name을 mutate.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runLlmPreExpand(parsedItems: any[]): Promise<void> {
  console.log(`[LLM PreExpand] 시작: ${parsedItems.length}개 품목`);

  const expandTargets: { itemIdx: number; query: string; isToken?: boolean; tokenIdx?: number; tokens?: string[] }[] = [];

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];
    const name = String(item.name || "").trim();
    const isShort = name.length <= 4;
    const isKoreanAbbrev = /^[가-힣]{2,3}$/.test(name);
    const koreanCharCount = (name.match(/[가-힣]/g) || []).length;

    if (isShort || isKoreanAbbrev) {
      expandTargets.push({ itemIdx: i, query: name });
      continue;
    }
    const tokens = name.split(/\s+/);
    if (tokens.length >= 2 && koreanCharCount < 3) {
      for (let t = 0; t < tokens.length; t++) {
        if (tokens[t].length <= 4 || /^[가-힣]{2,3}$/.test(tokens[t])) {
          expandTargets.push({ itemIdx: i, query: tokens[t], isToken: true, tokenIdx: t, tokens });
        }
      }
    } else if (koreanCharCount >= 3) {
      item._llmExpanded = true;
      item._originalName = name;
    }
  }

  if (expandTargets.length === 0) return;

  const uniqueQueries = [...new Set(expandTargets.map((t) => t.query))];
  const batchResults = await expandQueriesBatch(uniqueQueries);
  console.log(`[LLM PreExpand] 배치 완료: ${uniqueQueries.length}개 고유 쿼리`);

  const tokenExpands = new Map<number, { tokens: string[]; anyExpanded: boolean }>();

  for (const target of expandTargets) {
    const expanded = batchResults.get(target.query);
    if (!expanded || expanded.confidence < 0.4 || expanded.expandedQueries.length === 0) continue;

    const item = parsedItems[target.itemIdx];

    if (target.isToken && target.tokens && target.tokenIdx !== undefined) {
      if (!tokenExpands.has(target.itemIdx)) {
        tokenExpands.set(target.itemIdx, { tokens: [...target.tokens], anyExpanded: false });
      }
      const te = tokenExpands.get(target.itemIdx)!;
      te.tokens[target.tokenIdx] = expanded.wineName;
      te.anyExpanded = true;
    } else {
      console.log(`[LLM PreExpand] "${target.query}" → "${expanded.wineName}" (conf=${expanded.confidence})`);
      item._llmExpanded = expanded;
      item._originalName = target.query;
      item.name = expanded.wineName;
    }
  }

  // 토큰별 확장 결과 적용
  for (const [itemIdx, te] of tokenExpands.entries()) {
    if (!te.anyExpanded) continue;
    const item = parsedItems[itemIdx];
    const newName = te.tokens.join(' ');
    const origName = String(item.name || "");
    console.log(`[LLM PreExpand] "${origName}" → "${newName}" (토큰별 확장)`);
    item._llmExpanded = { originalQuery: origName, expandedQueries: [newName], wineName: newName, confidence: 0.95 };
    item._originalName = origName;
    item.name = newName;
  }
}
