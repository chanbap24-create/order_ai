/**
 * ========================================
 * 조합 가중치 기반 품목 매칭 시스템
 * ========================================
 *
 * resolveItems.ts의 가중치 시스템 버전
 * 여러 신호를 종합해서 정교한 매칭 수행
 *
 * ✅ 부분 토큰 매칭 추가 (2026-01-19)
 * ✅ 신규 품목 검색 통합 (2026-01-19)
 * ✅ 생산자 필터링 비활성화 (2026-01-19)
 * ✅ 다단계 토큰 매칭 추가 (2026-01-30) - 루이미셸 샤블리 검색 개선
 */

import { supabase } from "@/app/lib/db";
import { applyItemSynonym } from "@/app/lib/itemsynonyms";
import { calculateWeightedScoreCached, preloadScoringData, type PreloadedScoringData } from "@/app/lib/weightedScoring";
import { searchMasterSheet } from "@/app/lib/masterMatcher";
import { ITEM_MATCH_CONFIG } from "@/app/lib/itemMatchConfig";
import { expandQuery, logQueryExpansion, generateQueryVariations } from "@/app/lib/queryExpander";
import { preprocessNaturalLanguage, normalizeProducers } from "@/app/lib/naturalLanguagePreprocessor";
import { loadAllMasterItems, getDownloadsPriceMap } from "@/app/lib/masterSheet";
import { multiLevelTokenMatch } from "@/app/lib/multiLevelTokenMatcher";
import { findItemCodeFromEnglish, findMultipleFromEnglish } from "@/app/lib/englishSheetMatcher";

// 추출 모듈
import { normTight, stripQtyAndUnit, normalizeItemName, norm } from "./resolve-items-weighted/normalize";
import { areTokenSynonyms, tokenSynonymMap, WINE_TOKEN_SYNONYM_GROUPS } from "./resolve-items-weighted/tokenSynonyms";
import { decomposeCompoundKorean, scoreCompoundTokenMatch, hasVintageHint as _hasVintageHint } from "./resolve-items-weighted/compoundToken";
import { detectProducer, getAllProducers, WINE_PRODUCERS } from "./resolve-items-weighted/producers";
import { scoreItem } from "./resolve-items-weighted/scoreItem";
import { getAllTokens, fetchFromMasterByTail, searchNewItemFromMaster, loadEnglishMap } from "./resolve-items-weighted/masterFetch";
import { isSpecificAlias, getLearnedMatch, getLearnedMatchCached, type LearnedMatch } from "./resolve-items-weighted/alias";
import { tryExactItemNoMatch } from "./resolve-items-weighted/exactItemNoMatch";

// 외부 호환용 re-export
export { hasVintageHint } from "./resolve-items-weighted/compoundToken";
/* ================= 메인 함수 ================= */

export interface ResolvedItem {
  name: string;
  qty: number;
  normalized_query: string;
  resolved: boolean;
  item_no?: string;
  item_name?: string;
  score?: number;
  method?: string;
  candidates: Array<{
    item_no: string;
    item_name: string;
    score: number;
    _debug?: any; // 디버그 정보
  }>;
  suggestions: Array<{
    item_no: string;
    item_name: string;
    score: number;
  }>;
}

export async function resolveItemsByClientWeighted(
  clientCode: string,
  items: Array<{ name: string; qty: number }>,
  opts?: { minScore?: number; minGap?: number; topN?: number }
): Promise<ResolvedItem[]> {
  const minScore = opts?.minScore ?? 0.55;
  const minGap = opts?.minGap ?? 0.15;
  const topN = opts?.topN ?? 5;

  // 🔥 Downloads price map 미리 로드 (캐시 우회)
  console.log('[resolveItemsByClientWeighted] 🚀 Pre-loading Downloads price map...');
  const priceMap = getDownloadsPriceMap();
  console.log(`[resolveItemsByClientWeighted] ✅ Price map loaded: ${priceMap.size} items`);

  // 찰스 하이직 샘플 확인
  const charlesPrice = priceMap.get('00NV801');
  console.log(`[resolveItemsByClientWeighted] Sample check: 00NV801 = ${charlesPrice ? charlesPrice.toLocaleString() + '원' : '❌ 없음'}`);

  // ✅ 마스터 데이터는 inventory_cdv 테이블 사용 (Excel sync에서 이미 동기화됨)

  // 거래처 이력 후보
  // ✅ 신규 사업자(NEW)는 이력이 없으므로 빈 배열로 초기화
  let clientRows: Array<{ item_no: string; item_name: string }> = [];
  if (clientCode !== "NEW") {
    const { data: clientRowsData } = await supabase
      .from('client_item_stats')
      .select('item_no, item_name')
      .eq('client_code', clientCode);
    clientRows = (clientRowsData || []) as Array<{ item_no: string; item_name: string }>;
  }

  console.log(`[resolveItemsWeighted] clientCode="${clientCode}", clientRows.length=${clientRows.length}`);

  // 영문명 맵
  const englishMap = await loadEnglishMap();

  // 🚀 성능 최적화: 스코어링 데이터 일괄 프리로드 (N+1 쿼리 방지)
  const preloaded = await preloadScoringData(clientCode);
  console.log(`[resolveItemsWeighted] 🚀 프리로드 완료: aliases=${preloaded.itemAliases.length}, stats=${preloaded.clientStats.size}, tokens=${preloaded.tokenMappings.length}, prices=${preloaded.supplyPrices.size}`);

  // items.map() → sequential for loop (async operations inside)
  const resolvedItems: ResolvedItem[] = [];

  for (const it of items) {
    try {
    // ✨ 1단계: 자연어 전처리 (별칭 확장, 수량/와인용어 정규화)
    // ⚠️ LLM 사전 확장된 품목은 전처리 건너뛰기 (역방향 매핑으로 원래 약어로 되돌아가는 버그 방지)
    let searchName: string;
    if ((it as any)._llmExpanded || (it as any)._originalName) {
      // LLM/사전 확장된 품목: expandAliases 스킵 (역방향 매핑 오염 방지)
      // normalizeProducers만 적용 (at→알테시노, bs→비온디산티 등 브랜드코드 변환)
      searchName = normalizeProducers(it.name);
      console.log(`[resolveItemsWeighted] 입력: "${it.name}" → 생산자정규화: "${searchName}" (확장됨, expandAliases 스킵)`);
    } else {
      const preprocessed = await preprocessNaturalLanguage(it.name);
      searchName = preprocessed !== it.name ? preprocessed : it.name;
      console.log(`[resolveItemsWeighted] 입력: "${it.name}" → 전처리: "${searchName}"`);
    }

    // 🔍 0단계: 품목번호 정확 매칭 (최우선) — exactItemNoMatch.ts 로 추출
    const exactMatch = await tryExactItemNoMatch(searchName, clientCode);
    if (exactMatch) {
      const { supply_price, resolved, ...rest } = exactMatch;
      if (resolved) {
        resolvedItems.push({
          ...it,
          normalized_query: searchName,
          resolved: true,
          item_no: rest.item_no,
          item_name: rest.item_name,
          score: rest.score,
          method: rest.method,
          candidates: [],
          suggestions: [],
        });
      } else {
        resolvedItems.push({
          ...it,
          normalized_query: searchName,
          resolved: false,
          method: rest.method,
          candidates: [],
          suggestions: [{
            item_no: rest.item_no,
            item_name: rest.item_name,
            score: rest.score,
            is_new_item: true,
            supply_price,
          } as any],
        });
      }
      continue;
    }

    // ✨ 2단계: 검색어 확장 (토큰 매핑 학습 활용)
    const expansion = await expandQuery(searchName, 0.5);
    logQueryExpansion(expansion);

    // 🏭 생산자 감지 (브랜드가 명시된 경우 해당 브랜드만 검색)
    const { hasProducer, producer } = await detectProducer(searchName);

    if (hasProducer) {
      console.log(`[Wine] 생산자 감지됨: "${producer}" - 해당 브랜드 품목만 필터링`);
    }

    // ✅ 학습 매칭은 원본 이름(it.name)으로 먼저, 전처리된 이름으로 폴백 (캐시 기반)
    const learned = getLearnedMatchCached(it.name, clientCode, preloaded.itemAliases) || getLearnedMatchCached(searchName, clientCode, preloaded.itemAliases);
    const learnedItemNo =
      learned?.canonical && /^\d+$/.test(learned.canonical) ? learned.canonical : null;

    // 마스터 후보 (전처리된 검색어 + 확장된 검색어)
    const masterRows1 = await fetchFromMasterByTail(searchName, 40);
    const masterRows2 = expansion.hasExpansion
      ? await fetchFromMasterByTail(expansion.expanded, 40)
      : [];

    // ✅ 영문명으로도 검색 (English 시트 활용)
    const englishRows: Array<{ item_no: string; item_name: string; supply_price?: number }> = [];
    const hasEnglish = /[A-Za-z]{3,}/.test(searchName);
    if (hasEnglish) {
      try {
        console.log(`[English Sheet] 영어 검색 시도: "${searchName}"`);
        const englishMatches = await findMultipleFromEnglish(searchName, 10);

        for (const match of englishMatches) {
          // 거래처 이력에 있는 한글명 사용 (프리로드 데이터 활용 - DB 조회 없음)
          const clientHit = clientRows.find(cr => String(cr.item_no) === match.code);
          const clientStat = preloaded.clientStats.get(match.code);

          const displayName = clientHit?.item_name || match.koreanName || match.englishName;
          const supplyPrice = clientStat?.supply_price || match.supplyPrice || preloaded.supplyPrices.get(match.code);

          englishRows.push({
            item_no: match.code,
            item_name: displayName,
            supply_price: supplyPrice
          });
        }

        if (englishRows.length > 0) {
          console.log(`[English Sheet] ✅ ${englishRows.length}개 매칭됨`);
          englishRows.forEach((r, idx) => {
            console.log(`  ${idx+1}. [${r.item_no}] ${r.item_name} (공급가: ${r.supply_price?.toLocaleString() || 'N/A'}원)`);
          });
        }
      } catch (e) {
        console.error('[English Sheet] 검색 실패:', e);
      }
    }

    // 후보 풀 = 거래처이력(최우선) + 마스터(원본) + 마스터(확장) + 영문명 (중복 제거)
    // ✅ 거래처 이력을 최우선으로 추가하여 한글 품목명이 영문 약자보다 먼저 매칭되도록 함
    // 예: 3021049 "클레멍 라발리, 샤블리" (거래처 이력) > 3022049 "CL 샤블리" (마스터)
    const poolMap = new Map<string, { item_no: string; item_name: string; supply_price?: number }>();

    // 1순위: 거래처 이력 (한글 품목명 우선)
    for (const r of clientRows) {
      poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
    }

    // 2순위: 마스터 품목 (거래처 이력에 없는 것만 추가)
    for (const r of masterRows1) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
      }
    }
    for (const r of masterRows2) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), { item_no: String(r.item_no), item_name: String(r.item_name) });
      }
    }

    // 3순위: 영문명 (거래처 이력에 없는 것만 추가, 공급가 포함)
    for (const r of englishRows) {
      if (!poolMap.has(String(r.item_no))) {
        poolMap.set(String(r.item_no), {
          item_no: String(r.item_no),
          item_name: String(r.item_name),
          supply_price: r.supply_price
        });
      }
    }

    const pool = Array.from(poolMap.values());

    console.log(`[후보풀] 거래처이력 ${clientRows.length}개 + 마스터 ${masterRows1.length + masterRows2.length}개 + 영문 ${englishRows.length}개 = 총 ${pool.length}개`);

    // 🏭 생산자 필터링: 생산자가 감지되면 해당 생산자 품목만 남기기
    let filteredPool = pool;
    if (hasProducer && producer) {
      const producerNorm = normTight(producer);
      filteredPool = pool.filter(r => {
        const itemNameNorm = normTight(r.item_name);
        const matches = itemNameNorm.includes(producerNorm);

        if (!matches) {
          console.log(`[Producer Filter] ❌ 제외: "${r.item_name}" (생산자 불일치)`);
        }

        return matches;
      });

      console.log(`[Producer Filter] 생산자 "${producer}" 필터 적용: ${pool.length}개 → ${filteredPool.length}개`);

      // 필터링 후 후보가 너무 적으면 경고
      if (filteredPool.length === 0) {
        console.warn(`[Producer Filter] ⚠️ 생산자 필터링 후 후보가 0개! 필터 무시하고 전체 검색`);
        filteredPool = pool; // 롤백
      } else if (filteredPool.length < 3) {
        console.warn(`[Producer Filter] ⚠️ 생산자 필터링 후 후보가 ${filteredPool.length}개만 남음`);
      }
    }

    // 1) Exact 학습이면 하드 확정
    if (learned && learned.kind === "exact" && learnedItemNo) {
      let hit = filteredPool.find((r) => String(r.item_no) === learnedItemNo);
      // ✅ 풀에 없으면 DB에서 직접 조회 (학습된 약어 → 품목번호 매핑)
      if (!hit) {
        const { data: dbRow } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name')
          .eq('item_no', learnedItemNo)
          .limit(1)
          .maybeSingle();
        if (dbRow) hit = { item_no: String(dbRow.item_no), item_name: String(dbRow.item_name) };
      }
      if (hit) {
        console.log(`[Learn] ✅ alias_exact 매칭: "${searchName}" → ${hit.item_no} ${hit.item_name}`);
        resolvedItems.push({
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(searchName)),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 1.0,
          method: "alias_exact_item_no",
          candidates: [],
          suggestions: [],
        });
        continue;
      }
    }

    // 2) contains_specific 학습이면 하드 확정
    if (learned && learned.kind === "contains_specific" && learnedItemNo) {
      let hit = filteredPool.find((r) => String(r.item_no) === learnedItemNo);
      // ✅ 풀에 없으면 DB에서 직접 조회
      if (!hit) {
        const { data: dbRow } = await supabase
          .from('inventory_cdv')
          .select('item_no, item_name')
          .eq('item_no', learnedItemNo)
          .limit(1)
          .maybeSingle();
        if (dbRow) hit = { item_no: String(dbRow.item_no), item_name: String(dbRow.item_name) };
      }
      if (hit) {
        console.log(`[Learn] ✅ alias_contains_specific 매칭: "${searchName}" → ${hit.item_no} ${hit.item_name}`);
        resolvedItems.push({
          ...it,
          normalized_query: normalizeItemName(applyItemSynonym(searchName)),
          resolved: true,
          item_no: hit.item_no,
          item_name: hit.item_name,
          score: 0.99,
          method: "alias_contains_specific_item_no",
          candidates: [],
          suggestions: [],
        });
        continue;
      }
    }

    // 3) 🎯 조합 가중치 시스템으로 점수 계산
    // ⚠️ LLM 확장된 품목은 이미 정확한 이름이므로 synonym 재적용 스킵
    // (이중 확장 방지: "카베르네 소비뇽" → "카베르네 소비뇽 블랑 소비뇽 블랑")
    const synonymApplied = ((it as any)._llmExpanded || (it as any)._originalName)
      ? searchName
      : applyItemSynonym(searchName);
    const q = normalizeItemName(synonymApplied);
    const qExpanded = expansion.hasExpansion ? normalizeItemName(expansion.expanded) : q;

    // Sequential scoring loop (calculateWeightedScore is async)
    const scoredRaw: Array<{
      item_no: string;
      item_name: string;
      score: number;
      is_new_item?: boolean;
      supply_price?: number;
      _debug?: any;
    }> = [];

    for (const r of filteredPool) {
      // 생산자 옵션은 이미 필터링했으므로 불필요 (하지만 점수 계산에는 유지)
      const scoreOptions = hasProducer ? { producer } : undefined;

      // 원본 쿼리 점수
      const ko1 = scoreItem(q, r.item_name, scoreOptions);

      // 확장된 쿼리 점수 (학습 효과)
      const ko2 = expansion.hasExpansion ? scoreItem(qExpanded, r.item_name, scoreOptions) : 0;

      // 영문명 점수 (정규화 전 원본 searchName 사용)
      const enName = englishMap.get(String(r.item_no)) || "";
      const en1 = enName ? scoreItem(q, enName, scoreOptions) : 0;
      const en2 = enName ? scoreItem(searchName.toLowerCase(), enName, scoreOptions) : 0;
      const en = Math.max(en1, en2);

      // 최고 점수 선택 (확장 검색은 20% 부스트)
      const baseScore = Math.max(ko1, ko2 * 1.2, en);

      // 🎯 가중치 시스템으로 최종 점수 계산 (캐시 기반 - DB 조회 제로)
      const weighted = calculateWeightedScoreCached(
        it.name,
        clientCode,
        String(r.item_no),
        baseScore,
        preloaded,
        undefined, // dataType (기본값 'wine' 사용)
        (r as any).supply_price // ✅ 신규 품목인 경우에만 있음
      );

      // ✅ baseScore가 매우 높으면 (0.80+) 가중치를 덜 받도록 조정
      // 이유: "아이니 샤도네이" 검색 시 "CK 샤도네이"가 "PS 루씨아"보다 우선되어야 함
      let finalScore = weighted.finalScore;
      if (baseScore >= 0.80 && weighted.finalScore < baseScore) {
        // baseScore가 높은데 가중치로 인해 낮아진 경우, baseScore를 더 중시
        finalScore = baseScore * 0.7 + weighted.finalScore * 0.3;
        console.log(`[resolveItemsWeighted] High baseScore boost: ${r.item_no} ${r.item_name.substring(0, 30)} - base:${baseScore.toFixed(3)} → weighted:${weighted.finalScore.toFixed(3)} → final:${finalScore.toFixed(3)}`);
      }

      // ✅ 거래처 이력에 있는지 확인 (is_new_item 플래그 설정)
      const isInClientHistory = clientRows.some(cr => String(cr.item_no) === String(r.item_no));

      // ✅ supply_price 조회 (프리로드 맵에서 - DB 조회 없음)
      const supplyPrice: number | undefined = (r as any).supply_price
        || preloaded.supplyPrices.get(String(r.item_no))
        || undefined;

      scoredRaw.push({
        item_no: r.item_no,
        item_name: r.item_name,
        score: finalScore,
        is_new_item: !isInClientHistory, // 거래처 이력에 없으면 신규
        supply_price: supplyPrice,
        _debug: {
          baseScore: weighted.signals.baseScore,
          userLearning: weighted.signals.userLearning,
          recentPurchase: weighted.signals.recentPurchase,
          purchaseFrequency: weighted.signals.purchaseFrequency,
          vintage: weighted.signals.vintage,
          weights: weighted.weights,
          rawTotal: weighted.rawTotal,
          isInClientHistory,
        },
      });
    }

    const scored = scoredRaw
      .sort((a, b) => {
        // 1차: score 내림차순 (undefined 방어)
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        // 2차: baseScore 내림차순 (같은 최종 점수일 때 baseScore가 높은 것 우선)
        const aBase = a._debug?.baseScore ?? 0;
        const bBase = b._debug?.baseScore ?? 0;
        if (bBase !== aBase) return bBase - aBase;

        // 3차: 거래처 이력 우선 (같은 점수일 때 기존 거래처 품목 우선)
        const aInHistory = a._debug?.isInClientHistory ?? false;
        const bInHistory = b._debug?.isInClientHistory ?? false;
        if (aInHistory !== bInHistory) return aInHistory ? -1 : 1;

        // 4차: item_no 오름차순 (안정적인 정렬)
        return String(a.item_no).localeCompare(String(b.item_no));
      })
      // 🔍 공급가가 없는 품목 필터링
      .filter((item) => {
        if (item.supply_price && item.supply_price > 0) {
          return true;
        }
        console.log(`[Filter] ❌ 공급가 없음으로 제외 (scored): [${item.item_no}] ${item.item_name}`);
        return false;
      });

    console.log(`[Filter] scored 필터링 완료: 공급가 있는 품목만 ${scored.length}개`);

    const top = scored[0];
    const second = scored[1];

    // ✅ 중앙 설정에서 임계값 가져오기
    const config = ITEM_MATCH_CONFIG.autoResolve;

    // 자동확정 조건
    // ⚠️ 신규 사업자(NEW)는 절대 자동 확정하지 않음 (항상 수동 선택)
    // ⚠️ 신규 품목(is_new_item)은 절대 자동 확정하지 않음 (항상 수동 선택)
    let resolved =
      clientCode !== "NEW" &&
      !!top &&
      top.is_new_item !== true &&  // 🔴 신규 품목은 자동 확정 금지
      (top.score ?? 0) >= minScore &&
      (!second || (top.score ?? 0) - (second.score ?? 0) >= minGap);

    // 🏭 생산자가 명시된 경우 더 엄격한 조건 적용
    if (hasProducer && resolved) {
      const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;
      // 생산자 명시 시: 점수 0.85 이상, gap 0.25 이상 필요
      const allowAuto = (top.score ?? 0) >= 0.85 && gap >= 0.25;
      if (!allowAuto) {
        resolved = false;
        console.log(`[Wine] 생산자 명시 → 자동 확정 조건 강화:`, {
          producer: producer,
          score: (top.score ?? 0),
          gap: gap,
          allowAuto: allowAuto
        });
      }
    }

    // ✅ 토큰 3개 이상인 경우: 고신뢰도 점수 요구 (완화된 조건)
    const tokenCount = stripQtyAndUnit(it.name).split(" ").filter(Boolean).length;
    if (tokenCount >= 3) {
      const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;

      // learned가 있는 경우 (기존 로직 유지)
      if (learned?.kind === "contains_weak") {
        const allowAuto = ((top.score ?? 0) >= config.highConfidenceScore && gap >= config.highConfidenceGap) ||
                          ((top.score ?? 0) >= 0.88 && gap >= 0.20);  // ✅ 0.30 → 0.20 완화
        if (!allowAuto) {
          resolved = false;
        }
      }
      // learned가 없는 경우: 완화된 조건 (0.70 이상 + gap 0.15 이상)
      else if (!learned) {
        const allowAuto = ((top.score ?? 0) >= config.highConfidenceScore && gap >= config.highConfidenceGap) ||
                          ((top.score ?? 0) >= 0.70 && gap >= 0.15);  // ✅ minScore 0.70, minGap 0.30 → 0.15 완화
        if (!allowAuto) {
          resolved = false;
        }
      }
    }

    if (resolved) {
      resolvedItems.push({
        ...it,
        normalized_query: q,
        resolved: true,
        item_no: top.item_no,
        item_name: top.item_name,
        score: Number((top.score ?? 0).toFixed(3)),
        method: learned?.kind ? `weighted+${learned.kind}` : "weighted",
        candidates: (() => {
          // ✅ 중복 제거 (item_no 기준)
          const candidateMap = new Map<string, any>();
          for (const c of scored.slice(0, topN * 2)) {
            const existing = candidateMap.get(c.item_no);
            if (!existing || c.score > existing.score) {
              candidateMap.set(c.item_no, {
                item_no: c.item_no,
                item_name: c.item_name,
                score: Number((c.score ?? 0).toFixed(3)),
                is_new_item: c.is_new_item,
                supply_price: c.supply_price,
                _debug: c._debug,
              });
            }
          }

          // 🔍 공급가가 없는 품목 필터링
          const filteredCandidates = Array.from(candidateMap.values()).filter(item => {
            if (item.supply_price && item.supply_price > 0) {
              return true;
            }
            console.log(`[Filter] ❌ 공급가 없음으로 제외 (candidates): [${item.item_no}] ${item.item_name}`);
            return false;
          });

          console.log(`[Filter] candidates 필터링: ${Array.from(candidateMap.values()).length}개 → ${filteredCandidates.length}개`);

          return filteredCandidates
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) // undefined 방어
            .slice(0, topN);
        })(),
        suggestions: (() => {
          // ✅ suggestions도 중복 제거
          const suggestionMap = new Map<string, any>();
          for (const c of scored.slice(0, Math.max(10, topN) * 2)) {
            const existing = suggestionMap.get(c.item_no);
            if (!existing || c.score > existing.score) {
              suggestionMap.set(c.item_no, {
                item_no: c.item_no,
                item_name: c.item_name,
                score: Number((c.score ?? 0).toFixed(3)),
                is_new_item: c.is_new_item,
                supply_price: c.supply_price,
              });
            }
          }

          // 🔍 공급가가 없는 품목 필터링
          const filteredSuggestions = Array.from(suggestionMap.values()).filter(item => {
            if (item.supply_price && item.supply_price > 0) {
              return true;
            }
            console.log(`[Filter] ❌ 공급가 없음으로 제외: [${item.item_no}] ${item.item_name}`);
            return false;
          });

          console.log(`[Filter] suggestions 필터링: ${Array.from(suggestionMap.values()).length}개 → ${filteredSuggestions.length}개`);

          return filteredSuggestions
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) // undefined 방어
            .slice(0, Math.max(10, topN));
        })(),
      });
      continue;
    }

    // ✅ 신규 품목 검색: 항상 실행 (더 정확한 매칭을 찾기 위해)
    // baseScore가 높아도 신규 품목 중 더 나은 매칭이 있을 수 있음
    const topBaseScore = top?._debug?.baseScore || 0;
    const shouldSearchNew = true; // 항상 신규 품목도 함께 검색

    console.log('[Wine] 신규 품목 검색:', {
      topBaseScore,
      topFinalScore: top?.score,
      shouldSearchNew: true,
      reason: '항상 신규 품목과 기존 품목을 혼합 표시'
    });

    const suggestions = shouldSearchNew
      ? await (async () => {
          // 신규품목 검색 (English 시트)
          let newItems = await searchNewItemFromMaster(q);

          // 🏭 생산자 필터링 (생산자가 명시된 경우)
          if (hasProducer && newItems.length > 0) {
            const producerNorm = normTight(producer);
            newItems = newItems.filter(ni => {
              const nameNorm = normTight(ni.item_name);
              const match = nameNorm.includes(producerNorm);
              if (!match) {
                console.log(`[Wine] ❌ 신규 품목 생산자 불일치: "${producer}" not in "${ni.item_name}"`);
              }
              return match;
            });
            console.log(`[Wine] 생산자 필터 후 신규 품목: ${newItems.length}개`);
          }

          // 🔄 기존 품목(scored)과 신규 품목을 점수 기준으로 혼합
          const allItems = [
            // 기존 품목 상위 10개
            ...scored.slice(0, 10).map((c) => ({
              item_no: c.item_no,
              item_name: c.item_name,
              score: Number((c.score ?? 0).toFixed(3)),
              is_new_item: c.is_new_item,
              supply_price: c.supply_price,
            })),
            // 신규 품목
            ...newItems
          ];

          // 중복 제거 (item_no 기준)
          const itemMap = new Map<string, typeof allItems[0]>();
          for (const item of allItems) {
            const existing = itemMap.get(item.item_no);
            if (!existing || item.score > existing.score) {
              itemMap.set(item.item_no, item);
            }
          }

          // 🔍 공급가가 없는 품목 필터링
          const filteredItems = Array.from(itemMap.values()).filter(item => {
            // 공급가가 있으면 OK
            if (item.supply_price && item.supply_price > 0) {
              return true;
            }

            // 공급가가 없으면 제외
            console.log(`[Filter] ❌ 공급가 없음으로 제외: [${item.item_no}] ${item.item_name}`);
            return false;
          });

          console.log(`[Filter] 필터링 결과: ${Array.from(itemMap.values()).length}개 → ${filteredItems.length}개 (공급가 있는 품목만)`);

          // 점수 순으로 정렬 후 상위 10개
          const combined = filteredItems
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          console.log('[DEBUG] 기존+신규 혼합 후보 (10개 목표):', {
            hasProducer: hasProducer,
            producer: producer,
            scored: scored.length,
            newItems: newItems.length,
            combined: combined.length,
            top3: combined.slice(0, 3).map(c => ({ no: c.item_no, score: c.score, new: c.is_new_item }))
          });

          return combined;
        })()
      : (() => {
          // 🔍 공급가가 없는 품목 필터링
          const filteredScored = scored.slice(0, Math.max(10, topN))
            .filter((c) => {
              if (c.supply_price && c.supply_price > 0) {
                return true;
              }
              console.log(`[Filter] ❌ 공급가 없음으로 제외 (fallback): [${c.item_no}] ${c.item_name}`);
              return false;
            });

          console.log(`[Filter] fallback 필터링: ${scored.slice(0, Math.max(10, topN)).length}개 → ${filteredScored.length}개`);

          return filteredScored.map((c) => ({
            item_no: c.item_no,
            item_name: c.item_name,
            score: Number((c.score ?? 0).toFixed(3)),
            is_new_item: c.is_new_item,
            supply_price: c.supply_price,
          }));
        })();

    resolvedItems.push({
      ...it,
      normalized_query: q,
      resolved: false,
      candidates: (() => {
        // ✅ 중복 제거 (item_no 기준으로 최고 점수만 유지)
        const candidateMap = new Map<string, any>();
        for (const c of scored.slice(0, topN * 2)) { // 여유있게 2배 검색
          const existing = candidateMap.get(c.item_no);
          if (!existing || c.score > existing.score) {
            candidateMap.set(c.item_no, {
              item_no: c.item_no,
              item_name: c.item_name,
              score: Number((c.score ?? 0).toFixed(3)),
              is_new_item: c.is_new_item,
              supply_price: c.supply_price,
              _debug: c._debug,
            });
          }
        }
        return Array.from(candidateMap.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, topN);
      })(),
      suggestions,
    });
    } catch (err: any) {
      console.error(`[resolveItemsWeighted] ERROR for item "${it.name}":`, err);
      console.error(`[resolveItemsWeighted] Stack:`, err.stack);
      throw err; // Re-throw to see full stack
    }
  }

  return resolvedItems;
}
