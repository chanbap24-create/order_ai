import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { parseItemsFromMessage } from "@/app/lib/parseItems";
import { resolveItemsByClient } from "@/app/lib/resolveItems";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { searchNewItem } from "@/app/lib/newItemResolver";
import { syncFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";
import { jsonResponse } from "@/app/lib/api-response";
import type { ParseFullOrderResponse } from "@/app/types/api";
import { hierarchicalSearch } from "@/app/lib/brandMatcher";
import { logger } from "@/app/lib/logger";
import { rerankWithLLM, needsReranking, expandQueryWithLLM, expandQueriesBatch } from "@/app/lib/llmReranker";

// 추출 모듈
import { preExpandAbbreviationsInMessage, preprocessMessage } from "./parse/preprocess";
import {
  cleanClientCode, norm, extractKoreanTokens, pickBrandToken, firstLine, scoreName,
  extractVintage, removeVintageFromName, isLikelyOrderLine, splitClientAndOrder,
} from "./parse/utils";
import { getDeliveryDateKST } from "./parse/deliveryDate";
import { resolveClient } from "./parse/resolveClient";
import { formatStaffMessage } from "./parse/formatStaffMessage";

/**
 * 번역 전 약어 사전 확장: 메시지 내 와인 약어를 한국어로 미리 확장
 * → 한국어 비율 높아져서 불필요한 GPT 번역 방지 (at, bs 등 브랜드코드 보호)
 * 예: "at rdm 6" → "at 로쏘 디 몬탈치노 6" (rdm만 확장, at는 유지)
 */
function preExpandAbbreviationsInMessage(text: string): string {
  return text.replace(/\S+/g, (token) => {
    // 숫자/한글만으로 된 토큰은 스킵
    if (/^\d+$/.test(token) || /^[가-힣]+$/.test(token)) return token;
    // 후행 구두점 분리
    const match = token.match(/^(.+?)([.,;:!?병]+)?$/);
    if (!match) return token;
    const core = match[1];
    const suffix = match[2] || '';
    const result = expandFromDict(core);
    if (result) return result.wineName + suffix;
    return token;
  });
}

// GET 메소드 추가 (API 상태 확인용)
export async function GET() {
  // Excel 파일 존재 확인
  const fs = require('fs');
  const path = require('path');
  const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
  const xlsxExists = fs.existsSync(xlsxPath);

  let xlsxInfo = null;
  if (xlsxExists) {
    const stats = fs.statSync(xlsxPath);
    xlsxInfo = {
      exists: true,
      size: stats.size,
      modified: stats.mtime,
    };

    // 샘플 데이터 읽기
    try {
      const { loadMasterSheet } = require('@/app/lib/masterSheet');
      const items = loadMasterSheet();
      const sample = items.find((item: any) => item.itemNo === '3022042');
      xlsxInfo.sampleItem = sample || 'not found';
      xlsxInfo.totalItems = items.length;
    } catch (e: any) {
      xlsxInfo.loadError = e.message;
    }
  }

  return jsonResponse({
    success: true,
    message: "parse-full-order API is running. Use POST method to parse orders.",
    version: "2.0.0",
    features: {
      suggestions: 8,
      sorting: "existing_items_first",
      lastUpdated: "2026-02-02T04:45:00Z"
    },
    excel: xlsxInfo || { exists: false, path: xlsxPath }
  });
}
export async function POST(req: Request): Promise<NextResponse<ParseFullOrderResponse>> {
  // ✅ 엑셀 자동 동기화 (파일 변경 시에만 실행)
  const sync = await syncFromXlsxIfNeeded();
  logger.debug("[XLSX SYNC]", { result: sync });

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);
    const pageType = body?.type || "wine"; // 기본값 wine

    // ✅ 신규 사업자 처리
    const newBusiness = body?.newBusiness;
    if (newBusiness && newBusiness.name && newBusiness.phone) {
      logger.debug("[NEW BUSINESS]", { newBusiness });

      // 품목만 파싱
      const pre0 = preprocessMessage(body?.message ?? "");
      const pre0Expanded = preExpandAbbreviationsInMessage(pre0);
      const trMsg = await translateOrderToKoreanIfNeeded(pre0Expanded);
      const preMessage = trMsg.translated ? trMsg.text : pre0Expanded;
      const parsedItems = parseItemsFromMessage(preMessage)
        // ✅ "undefined" 필터링
        .filter(item => {
          const name = String(item.name || "").trim().toLowerCase();
          if (name === "undefined" || name === "null" || name === "") {
            logger.debug(`[FILTER] 무효 입력 제거`, { raw: item.raw });
            return false;
          }
          return true;
        });

      // 거래처 정보는 신규 사업자로 설정 (client_code는 임시로 "NEW")
      const client = {
        status: "resolved" as const,
        client_name: newBusiness.name,
        client_code: "NEW",
        phone: newBusiness.phone,
        email: newBusiness.email, // 이메일 추가
      };

      // 신규 사업자는 이력 없음 → master_items에서만 검색
      logger.debug("[NEW BUSINESS] Calling resolveItemsByClientWeighted", { itemCount: parsedItems.length });

      const resolvedItems = await resolveItemsByClientWeighted("NEW", parsedItems, {
        minScore: 0.55,
        minGap: 0.05,
        topN: 10, // ✅ 10개로 증가 (루이 미셸 등 다양한 브랜드 포함)
      });

      logger.debug("[NEW BUSINESS] resolvedItems", { count: resolvedItems.length });

      // suggestions 추가 (안전하게 score 처리)
      const itemsWithSuggestions = resolvedItems.map((it: any) => {
        // ✅ 확정/미확정 모두 candidates를 suggestions로 변환
        const candidates = it.candidates || [];
        const suggestions = candidates.slice(0, 10).map((c: any) => ({
          ...c,
          score: c.score ?? 0,
          supply_price: c.supply_price, // ✅ 공급가 포함
        }));

        return {
          ...it,
          suggestions,
        };
      });

      logger.debug("[NEW BUSINESS] itemsWithSuggestions", { count: itemsWithSuggestions.length });

      // ✅ 같은 item_no를 가진 아이템 통합 (수량 합산)
      const mergedItems = (() => {
        const itemMap = new Map<string, any>();
        for (const item of itemsWithSuggestions) {
          if (item.resolved && item.item_no) {
            const key = String(item.item_no);
            const existing = itemMap.get(key);
            if (existing) {
              // 같은 품목이 여러 번 확정된 경우 수량 합산
              existing.qty = (existing.qty || 0) + (item.qty || 0);
            } else {
              itemMap.set(key, { ...item });
            }
          } else {
            // 미확정 아이템은 그대로 추가 (중복 체크 안 함)
            itemMap.set(`unresolved_${Date.now()}_${Math.random()}`, { ...item });
          }
        }
        return Array.from(itemMap.values());
      })();

      logger.debug("[NEW BUSINESS] mergedItems", { count: mergedItems.length });

      const allResolved = mergedItems.every((it: any) => it.resolved);

      // 직원 메시지 생성
      logger.debug("[NEW BUSINESS] Calling formatStaffMessage");
      const staffMessage = await formatStaffMessage(
        client,
        mergedItems,
        {
          customDeliveryDate: body?.customDeliveryDate,
          requirePaymentConfirm: body?.requirePaymentConfirm,
          requireInvoice: body?.requireInvoice,
        }
      );

      logger.debug("[NEW BUSINESS] staffMessage generated");

      return jsonResponse({
        success: true,
        status: allResolved ? "resolved" : "needs_review_items",
        client,
        parsed_items: mergedItems,
        items: mergedItems, // ✅ 프론트엔드 호환성
        staff_message: staffMessage,
        is_new_business: true,
      } as any);
    }

    // ✅ 0) 전체 메시지 전처리 먼저
    const pre0 = preprocessMessage(body?.message ?? "");
    const pre0Expanded = preExpandAbbreviationsInMessage(pre0);

    // ✅ 0-1) 번역(영어 비중 높을 때만). 기존 데이터/로직 영향 없음.
    const trMsg = await translateOrderToKoreanIfNeeded(pre0Expanded);
    const preMessage = trMsg.translated ? trMsg.text : pre0Expanded;

    // ✅ 전처리된 message로 split 수행
    const { rawMessage, clientText, orderText } = splitClientAndOrder({
      ...body,
      message: preMessage,
    });

    // 1) 거래처 resolve
    // ✅ 프론트에서 이미 선택한 거래처가 있으면 바로 사용
    let client: any;
    if (body?.resolvedClientCode && body?.resolvedClientName) {
      logger.debug("[CLIENT] Using resolved client from frontend", { code: body.resolvedClientCode, name: body.resolvedClientName });
      client = {
        status: "resolved" as const,
        client_code: String(body.resolvedClientCode),
        client_name: String(body.resolvedClientName),
        method: "frontend_resolved",
      };
    } else {
      client = await resolveClient({
        clientText,
        message: rawMessage,
        forceResolve,
      });
    }

    if (client.status !== "resolved") {
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client,
        debug: {
          preprocessed_message: preMessage,
          translation_message: trMsg.translated ? "translated" : "no",
          clientText,
          orderText,
        },
      } as any);
    }

    // 2) 품목 파싱 (orderText도 한번 더 전처리)
    // ✅ resolvedClientCode가 있으면 원본 message 전체를 파싱 (거래처가 이미 분리되었으므로)
    const order0 = preprocessMessage(
      body?.resolvedClientCode ? rawMessage : (orderText || rawMessage)
    );

    // ✅ 2-1) 번역(영어 비중 높을 때만) — 사전 약어 확장으로 브랜드코드 보호
    const order0Expanded = preExpandAbbreviationsInMessage(order0);
    const trOrder = await translateOrderToKoreanIfNeeded(order0Expanded);
    const orderPre = trOrder.translated ? trOrder.text : order0Expanded;

    const parsedItems = parseItemsFromMessage(orderPre)
      // ✅ "undefined" 필터링: 프론트에서 빈 입력을 "undefined"로 보낼 때 제거
      .filter(item => {
        const name = String(item.name || "").trim().toLowerCase();
        logger.debug(`[FILTER-CHECK]`, { raw: item.raw, name });
        if (name === "undefined" || name === "null" || name === "") {
          logger.debug(`[FILTER] 무효 입력 제거`, { raw: item.raw });
          return false;
        }
        return true;
      });

    const clientCode = client?.client_code;
    if (!clientCode) {
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client,
        error: "client_code가 없어 품목 resolve를 진행할 수 없습니다.",
      } as any);
    }

    // ✅ 2-2) LLM 사전 확장: 짧은 약어 → 정식 와인명으로 변환 (매칭 전에 실행)
    // v2: 배치 호출로 API 비용 절감 (개별 N회 → 1회)
    if (pageType === "wine" && process.env.ANTHROPIC_API_KEY) {
      console.log(`[LLM PreExpand] 시작: ${parsedItems.length}개 품목`);

      // 확장 필요한 쿼리 수집
      const expandTargets: { itemIdx: number; query: string; isToken?: boolean; tokenIdx?: number; tokens?: string[] }[] = [];

      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const name = String(item.name || "").trim();
        const isShort = name.length <= 4;
        const isKoreanAbbrev = /^[가-힣]{2,3}$/.test(name);
        const koreanCharCount = (name.match(/[가-힣]/g) || []).length;

        if (isShort || isKoreanAbbrev) {
          expandTargets.push({ itemIdx: i, query: name });
        } else {
          const tokens = name.split(/\s+/);
          if (tokens.length >= 2 && koreanCharCount < 3) {
            for (let t = 0; t < tokens.length; t++) {
              if (tokens[t].length <= 4 || /^[가-힣]{2,3}$/.test(tokens[t])) {
                expandTargets.push({ itemIdx: i, query: tokens[t], isToken: true, tokenIdx: t, tokens });
              }
            }
          } else if (koreanCharCount >= 3) {
            (item as any)._llmExpanded = true;
            (item as any)._originalName = name;
          }
        }
      }

      if (expandTargets.length > 0) {
        // 배치 호출: 고유 쿼리만 추출 → 1회 LLM 호출
        const uniqueQueries = [...new Set(expandTargets.map(t => t.query))];
        const batchResults = await expandQueriesBatch(uniqueQueries);
        console.log(`[LLM PreExpand] 배치 완료: ${uniqueQueries.length}개 고유 쿼리`);

        // 결과 적용
        const tokenExpands = new Map<number, { tokens: string[]; anyExpanded: boolean }>();

        for (const target of expandTargets) {
          const expanded = batchResults.get(target.query);
          if (!expanded || expanded.confidence < 0.4 || expanded.expandedQueries.length === 0) continue;

          const item = parsedItems[target.itemIdx];

          if (target.isToken && target.tokens && target.tokenIdx !== undefined) {
            // 토큰별 확장
            if (!tokenExpands.has(target.itemIdx)) {
              tokenExpands.set(target.itemIdx, { tokens: [...target.tokens], anyExpanded: false });
            }
            const te = tokenExpands.get(target.itemIdx)!;
            te.tokens[target.tokenIdx] = expanded.wineName;
            te.anyExpanded = true;
          } else {
            // 전체 이름 확장
            console.log(`[LLM PreExpand] "${target.query}" → "${expanded.wineName}" (conf=${expanded.confidence})`);
            (item as any)._llmExpanded = expanded;
            (item as any)._originalName = target.query;
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
          (item as any)._llmExpanded = { originalQuery: origName, expandedQueries: [newName], wineName: newName, confidence: 0.95 };
          (item as any)._originalName = origName;
          item.name = newName;
        }
      }
    }

    // ✅ 3-0) 브랜드 우선 매칭 시도 (새로운 2단계 계층적 검색)
    // Wine 페이지에서만 활성화
    let brandMatchedItems: any[] = [];
    if (pageType === "wine") {
      logger.debug("[BrandMatch] 브랜드 우선 매칭 시작");
      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const inputName = item.name || '';
        if (!inputName) continue;

        try {
          let brandResults = await hierarchicalSearch(inputName, 0.5, 0.5, 2);

          // LLM 확장 키워드로도 브랜드 매칭 시도 (primary 실패 시)
          const llmExpanded = (item as any)._llmExpanded;
          if (brandResults.length === 0 && llmExpanded?.expandedQueries) {
            for (const eq of llmExpanded.expandedQueries) {
              if (eq === inputName) continue; // 이미 시도한 것 스킵
              const altResults = await hierarchicalSearch(eq, 0.4, 0.4, 2);
              if (altResults.length > 0 && altResults[0].wines.length > 0) {
                console.log(`[BrandMatch+LLM] "${(item as any)._originalName}" → "${eq}" 로 브랜드 매칭 성공`);
                brandResults = altResults;
                break;
              }
            }
          }

          if (brandResults.length > 0 && brandResults[0].wines.length > 0) {
            const topBrand = brandResults[0];
            const topWine = topBrand.wines[0];

            logger.debug(`[BrandMatch] 매칭`, { input: inputName, brand: topBrand.brand.supplier_kr, wine: topWine.wine_kr, score: topWine.score });

            // 브랜드 매칭된 아이템 저장 (원본 순서 인덱스 포함)
            brandMatchedItems.push({
              _originalIndex: i,
              raw: item.raw,
              name: (item as any)._originalName || item.name,
              qty: item.qty,
              normalized_query: inputName,
              _originalName: (item as any)._originalName,
              _llmExpanded: (item as any)._llmExpanded,
              // ✅ item_no가 유효하고 점수가 0.7 이상일 때만 자동 확정
              resolved: !!(topWine.item_no) && topWine.score >= 0.7,
              item_no: topWine.item_no,
              item_name: topWine.wine_kr,
              score: topWine.score,
              method: 'brand_hierarchical',
              supply_price: topWine.price,
              brand_info: {
                brand_name: topBrand.brand.supplier_kr,
                brand_score: topBrand.brand.score,
              },
              candidates: topBrand.wines.slice(0, 5).map((w: any) => ({
                item_no: w.item_no,
                item_name: w.wine_kr,
                score: w.score,
                method: 'brand_hierarchical',
                supply_price: w.price,
              })),
            });

            continue; // 브랜드 매칭 성공하면 기존 로직 스킵
          }
        } catch (err) {
          logger.error(`[BrandMatch] 오류`, err);
        }
      }
    }

    // 3) 품목 resolve
    // 🎯 조합 가중치 시스템으로 품목 매칭!
    // 브랜드 매칭되지 않은 품목만 기존 방식으로 처리
    const itemsToResolve = brandMatchedItems.length > 0
      ? parsedItems.map((item: any, idx: number) => ({ ...item, _originalIndex: idx }))
          .filter((item: any) =>
            !brandMatchedItems.some((bm: any) => bm.name === item.name)
          )
      : parsedItems.map((item: any, idx: number) => ({ ...item, _originalIndex: idx }));

    logger.debug(`[품목 resolve]`, { total: parsedItems.length, brandMatched: brandMatchedItems.length, fallback: itemsToResolve.length });

    let resolvedItems = itemsToResolve.length > 0
      ? await resolveItemsByClientWeighted(clientCode, itemsToResolve, {
          minScore: 0.55,
          minGap: 0.05,
          topN: 5,
        })
      : [];

    // ✅ LLM 쿼리 확장 (사후): 사전 확장 안 된 품목만 → Claude가 와인명 해석 → 재검색
    if (resolvedItems.length > 0 && process.env.ANTHROPIC_API_KEY) {
      const expandedResults: any[] = [];
      for (const item of resolvedItems) {
        // 이미 사전 확장된 항목은 스킵 (중복 LLM 호출 방지)
        if (item._llmExpanded || item._originalName) {
          expandedResults.push(item);
          continue;
        }
        const topScore = item?.score ?? (item?.candidates?.[0]?.score ?? 0);
        if (topScore < 0.5 && item.name) {
          try {
            const expanded = await expandQueryWithLLM(String(item.name));
            if (expanded && expanded.expandedQueries.length > 0 && expanded.confidence >= 0.5) {
              logger.debug(`[LLM Expand] "${item.name}" → "${expanded.wineName}" (${expanded.expandedQueries.join(", ")})`);

              // 확장된 키워드로 브랜드 매칭 재시도
              let bestResult: any = null;
              for (const eq of expanded.expandedQueries) {
                try {
                  const brandResults = await hierarchicalSearch(eq, 0.4, 0.3, 3);
                  if (brandResults.length > 0 && brandResults[0].wines.length > 0) {
                    const topBrand = brandResults[0];
                    const topWine = topBrand.wines[0];
                    if (!bestResult || topWine.score > (bestResult.score ?? 0)) {
                      bestResult = {
                        ...item,
                        resolved: !!(topWine.item_no) && topWine.score >= 0.6,
                        item_no: topWine.item_no,
                        item_name: topWine.wine_kr,
                        score: topWine.score,
                        method: 'llm_expand_brand',
                        supply_price: topWine.price,
                        llm_expanded: expanded.wineName,
                        candidates: topBrand.wines.slice(0, 8).map((w: any) => ({
                          item_no: w.item_no,
                          item_name: w.wine_kr,
                          score: w.score,
                          method: 'llm_expand_brand',
                          supply_price: w.price,
                        })),
                      };
                    }
                  }
                } catch { /* skip */ }
              }

              // 브랜드 매칭 실패 시 가중치 매칭 재시도
              if (!bestResult || (bestResult.score ?? 0) < 0.4) {
                for (const eq of expanded.expandedQueries.slice(0, 2)) {
                  try {
                    const reResolved = await resolveItemsByClientWeighted(clientCode,
                      [{ ...item, name: eq, _originalIndex: item._originalIndex }],
                      { minScore: 0.4, minGap: 0.03, topN: 5 }
                    );
                    if (reResolved.length > 0) {
                      const rr = reResolved[0];
                      const rrScore = rr?.score ?? (rr?.candidates?.[0]?.score ?? 0);
                      if (!bestResult || rrScore > (bestResult.score ?? 0)) {
                        bestResult = { ...rr, llm_expanded: expanded.wineName, method: 'llm_expand_weighted' };
                      }
                    }
                  } catch { /* skip */ }
                }
              }

              if (bestResult && (bestResult.score ?? 0) > topScore) {
                logger.debug(`[LLM Expand] 개선됨`, { name: item.name, before: topScore, after: bestResult.score });
                expandedResults.push(bestResult);
                continue;
              }
            }
          } catch (err) {
            logger.error(`[LLM Expand] 오류`, err);
          }
        }
        expandedResults.push(item);
      }
      resolvedItems = expandedResults;
    }

    // 브랜드 매칭 결과와 기존 방식 결과 병합 후 원본 순서로 정렬
    const allResolvedItems = [...brandMatchedItems, ...resolvedItems]
      .sort((a: any, b: any) => (a._originalIndex ?? 0) - (b._originalIndex ?? 0));

    // ✅ 3-1) unresolved인 품목에 후보 3개(suggestions) 붙이기 (UI용)
    //     - 새로 DB에서 찾지 말고, resolveItemsByClient가 만든 candidates를 그대로 사용
    //     - 🆕 신규 품목: 기존 매칭이 약하면 English 시트에서 검색

    // ✅ 거래처 이력 먼저 조회 (is_new_item 판단용) - 한 번만 조회
    const { data: clientHistoryRows } = await supabase
      .from("client_item_stats")
      .select("item_no")
      .eq("client_code", clientCode);

    const clientItemSet = new Set((clientHistoryRows || []).map(r => String(r.item_no)));
    logger.debug(`[거래처이력]`, { clientCode, itemCount: clientItemSet.size });

    const itemsWithSuggestions = await Promise.all(allResolvedItems.map(async (x: any) => {
      // ✅ resolved인데 item_no가 없으면 false로 변경 (최우선 검사)
      if (x?.resolved && !x?.item_no) {
        logger.warn(`[CRITICAL] resolved=true인데 item_no 없음 → resolved=false로 강제 변경`, { name: x.name });
        x = { ...x, resolved: false };
      }

      // ✅ 이미 resolved된 경우
      if (x?.resolved) {
        // ✅ resolved 품목도 suggestions 포함 (공급가 표시용)
        const candidates = Array.isArray(x?.candidates) ? x.candidates : [];
        const suggestions = candidates.slice(0, 10).map((c: any) => ({
          ...c,
          score: c.score ?? 0,
          supply_price: c.supply_price,
        }));
        return {
          ...x,
          suggestions,
        };
      }

      // ✅ 중앙 설정 가져오기
      const { ITEM_MATCH_CONFIG, decideSuggestionComposition } = require('@/app/lib/itemMatchConfig');
      const config = ITEM_MATCH_CONFIG;

      // candidates가 있으면 정렬 (아직 개수 제한 안 함)
      const candidates = Array.isArray(x?.candidates) ? x.candidates : [];

      // ✅ 빈티지 중복 제거 (기존 입고 품목끼리만 적용)
      const grouped = new Map<string, any[]>();
      for (const c of candidates) {
        const baseName = removeVintageFromName(c.item_name || '');
        if (!grouped.has(baseName)) {
          grouped.set(baseName, []);
        }
        grouped.get(baseName)?.push(c);
      }

      const dedupedCandidates: any[] = [];
      for (const [baseName, group] of grouped.entries()) {
        if (group.length === 1) {
          dedupedCandidates.push(group[0]);
        } else {
          // 기존 입고 품목과 신규 품목 분리
          const existingItems = group.filter(c => clientItemSet.has(String(c.item_no)));
          const newItems = group.filter(c => !clientItemSet.has(String(c.item_no)));

          // 기존 입고 품목 중에서 최신 빈티지 1개만 선택
          if (existingItems.length > 0) {
            const withVintage = existingItems.map(c => ({
              ...c,
              _vintage: extractVintage(c.item_no)
            }));

            const sorted = withVintage.sort((a, b) => {
              if (a._vintage && b._vintage) return b._vintage - a._vintage;
              return (b.score ?? 0) - (a.score ?? 0);
            });

            logger.debug(`[빈티지] 기존 입고 선택`, { baseName, itemNo: sorted[0].item_no, total: existingItems.length });
            dedupedCandidates.push(sorted[0]);
          }

          // 신규 품목은 모두 추가 (빈티지 상관없이)
          newItems.forEach(c => {
            logger.debug(`[빈티지] 신규 추가`, { baseName, itemNo: c.item_no });
            dedupedCandidates.push(c);
          });
        }
      }

      const sortedCandidates = dedupedCandidates
        .slice()
        .sort((a: any, b: any) => {
          // 1순위: 점수 내림차순
          const scoreDiff = (b?.score ?? 0) - (a?.score ?? 0);
          if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;

          // 2순위: 동점일 때 item_no 오름차순 (2420005 < 2421005)
          return String(a?.item_no ?? '').localeCompare(String(b?.item_no ?? ''));
        });

      // ⭐ 1단계: 기존 입고 품목에 점수 부스트 적용 (검색 결과에 포함되도록)
      const boostedCandidates = sortedCandidates.map((c: any) => {
        const isInClientHistory = clientItemSet.has(String(c.item_no));
        // 기존 입고 품목은 점수 5% 부스트 (가중 스코어링에서 이미 이력 반영됨, 이중 부스트 방지)
        const boostedScore = isInClientHistory ? (c.score ?? 0) * 1.05 : (c.score ?? 0);
        logger.debug(`[점수부스트]`, { itemNo: c.item_no, original: (c.score ?? 0), boosted: boostedScore, isExisting: isInClientHistory });
        return {
          ...c,
          score: boostedScore,
          original_score: c.score ?? 0, // 원래 점수 보관
          is_new_item: c.is_new_item ?? !isInClientHistory,
        };
      });

      // 점수 기준으로 재정렬
      boostedCandidates.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));

      // 기본 suggestions 초기화 (부스트 적용된 후보에서)
      let suggestions = boostedCandidates.slice(0, config.suggestions.total).map((c: any) => {
        logger.debug(`[후보선택]`, { itemNo: c.item_no, itemName: c.item_name, score: c.score, isNew: c.is_new_item });
        return c;
      });

      // 🆕 신규 품목 검색: Wine 페이지에서만 English 시트 검색
      if (pageType === "wine") {
        const bestScore = boostedCandidates.length > 0 ? boostedCandidates[0]?.original_score ?? 0 : 0; // 원래 점수 사용
        const inputName = x.name || '';

        // ✅ 중앙 설정에서 임계값 가져오기
        if (bestScore < config.newItemSearch.threshold && inputName) {
          logger.debug(`[신규품목] 검색 시도`, { inputName, bestScore });

          // 신규 품목 검색 시도
          const newItemCandidates = await searchNewItem(clientCode, inputName, bestScore, config.newItemSearch.threshold);

          if (newItemCandidates && newItemCandidates.length > 0) {
            logger.debug(`[신규품목] English 시트 결과`, { count: newItemCandidates.length });

            // ✅ GAP 기반 후보 조합 결정
            const composition = decideSuggestionComposition(boostedCandidates, newItemCandidates);

            logger.debug(`[후보조합]`, { type: composition.type, existing: composition.existing, newItems: composition.newItems, reason: composition.reason });

            // ✅ 신규품목 점수가 충분히 높을 때만 조합 적용
            // 그렇지 않으면 기존 품목을 전부 표시 (신규품목은 무시)
            const newItemBestScore = newItemCandidates[0]?.score ?? 0;
            const existingBestScore = boostedCandidates[0]?.original_score ?? 0; // 원래 점수 사용
            const shouldIncludeNewItems = newItemBestScore >= existingBestScore * 0.7; // 신규품목이 기존의 70% 이상

            if (!shouldIncludeNewItems) {
              logger.debug(`[후보조합] 신규품목 점수 낮음 → 기존품목만 표시`, { newBest: newItemBestScore, existingBest: existingBestScore });
              // 기존 품목만 표시 (composition 무시)
              suggestions = boostedCandidates.slice(0, config.suggestions.total); // 이미 is_new_item 설정됨
            } else {
              logger.debug(`[후보조합] 신규품목 포함`, { newBest: newItemBestScore, existingBest: existingBestScore });

              // ✅ 기존 후보도 is_new_item 추가
              const existingSuggestions = boostedCandidates.slice(0, composition.existing); // 이미 is_new_item 설정됨

              // 신규품목 매핑 (신규품목 플래그 포함)
              const newItemSuggestions = newItemCandidates.slice(0, composition.newItems).map((c) => {
                const isInClientHistory = clientItemSet.has(String(c.itemNo));
                return {
                  item_no: c.itemNo,
                  item_name: `${c.koreanName} / ${c.englishName}${c.vintage ? ` (${c.vintage})` : ''}`,
                  score: c.score,
                  source: 'master_sheet',
                  is_new_item: !isInClientHistory, // ✅ 거래처 이력 기반 판단
                  supply_price: c.supplyPrice,
                  _debug: c._debug,
                };
              });

              // 조합에 따라 후보 구성 후 점수 순으로 재정렬
              const allSuggestions = [
                ...existingSuggestions,
                ...newItemSuggestions
              ];

              // ✅ 중복 제거 (같은 품목 코드면 기존 입고품목 우선)
              // 1단계: item_no 기준으로 중복 제거 + 기존 입고품목 우선
              const groupByItemNo = new Map<string, any[]>();
              for (const s of allSuggestions) {
                const itemNo = String(s.item_no || '');
                if (!itemNo) continue; // item_no 없으면 스킵

                if (!groupByItemNo.has(itemNo)) {
                  groupByItemNo.set(itemNo, []);
                }
                groupByItemNo.get(itemNo)?.push(s);
              }

              const dedupedByItemNo: any[] = [];
              for (const [itemNo, group] of Array.from(groupByItemNo.entries())) {
                if (group.length === 1) {
                  dedupedByItemNo.push(group[0]);
                } else {
                  // ✅ 같은 item_no가 여러 개면: 기존 입고품목 우선 (is_new_item === false)
                  const existingItems = group.filter(s => s.is_new_item === false);
                  const newItems = group.filter(s => s.is_new_item === true);

                  if (existingItems.length > 0) {
                    // 기존 품목이 있으면 기존 품목만 표시 (점수 높은 것 우선)
                    const best = existingItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                    logger.debug(`[중복제거] 기존 입고품목 우선`, { itemNo, count: existingItems.length, itemName: best.item_name });
                    dedupedByItemNo.push(best);
                  } else {
                    // 기존 품목이 없으면 신규 품목 중 점수 높은 것
                    const best = newItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                    dedupedByItemNo.push(best);
                  }
                }
              }

              // 2단계: 품목명 기준으로 그룹화 (빈티지 중복 제거)
              const groupByName = new Map<string, any[]>();
              for (const s of dedupedByItemNo) {
                const baseNameWithoutVintage = removeVintageFromName(s.item_name || '');
                if (!groupByName.has(baseNameWithoutVintage)) {
                  groupByName.set(baseNameWithoutVintage, []);
                }
                groupByName.get(baseNameWithoutVintage)?.push(s);
              }

              // 3단계: 각 그룹에서 빈티지 선택 (기존 + 신규 빈티지 모두 표시)
              const deduped: any[] = [];
              for (const [baseName, group] of Array.from(groupByName.entries())) {
                if (group.length === 1) {
                  deduped.push(group[0]);
                } else {
                  // 빈티지 정보 추가
                  const withVintage = group.map(s => ({
                    ...s,
                    _vintage: extractVintage(s.item_no)
                  }));

                  // 기존 품목과 신규 품목 분리
                  const existingItems = withVintage.filter(s => s.is_new_item === false);
                  const newItems = withVintage.filter(s => s.is_new_item === true);

                  // 🔥 수정: 기존 품목이 있고 신규 품목도 있으면 둘 다 표시!
                  if (existingItems.length > 0 && newItems.length > 0) {
                    // 기존 품목: 최신 빈티지 선택
                    const existingSorted = existingItems.sort((a, b) => {
                      if (a._vintage && b._vintage) return b._vintage - a._vintage;
                      return (b.score ?? 0) - (a.score ?? 0);
                    });

                    // 신규 품목: 최신 빈티지 선택
                    const newSorted = newItems.sort((a, b) => {
                      if (a._vintage && b._vintage) return b._vintage - a._vintage;
                      return (b.score ?? 0) - (a.score ?? 0);
                    });

                    logger.debug(`[빈티지중복] 기존+신규 모두 표시`, { baseName, existing: existingSorted[0].item_no, newItem: newSorted[0].item_no });
                    deduped.push(existingSorted[0]); // 기존 품목 추가
                    deduped.push(newSorted[0]);      // 신규 빈티지 추가
                  }
                  // 기존 품목만 있거나 신규 품목만 있으면 최신 빈티지 선택
                  else {
                    const sorted = withVintage.sort((a, b) => {
                      // 1순위: 기존 품목 우선
                      const aIsExisting = a.is_new_item === false;
                      const bIsExisting = b.is_new_item === false;
                      if (aIsExisting && !bIsExisting) return -1;
                      if (!aIsExisting && bIsExisting) return 1;

                      // 2순위: 빈티지가 있으면 최신 우선
                      if (a._vintage && b._vintage) {
                        return b._vintage - a._vintage;
                      }
                      return (b.score ?? 0) - (a.score ?? 0);
                    });

                    const selected = sorted[0];
                    if (group.length > 1) {
                      const isExisting = selected.is_new_item === false;
                      logger.debug(`[빈티지중복] 선택`, { baseName, itemNo: selected.item_no, type: isExisting ? '기존품목' : '신규빈티지', vintage: selected._vintage, groupSize: group.length });
                    }
                    deduped.push(selected);
                  }
                }
              }

              // ✅ 기존 품목 우선 정렬 → 각 그룹 내에서 점수 내림차순
              suggestions = deduped
                .sort((a: any, b: any) => {
                  // 1순위: 기존 품목 (is_new_item=false)을 위로
                  const aIsExisting = a.is_new_item === false;
                  const bIsExisting = b.is_new_item === false;
                  if (aIsExisting && !bIsExisting) return -1;
                  if (!aIsExisting && bIsExisting) return 1;

                  // 2순위: 같은 그룹(기존 or 신규) 내에서는 점수 내림차순
                  return (b.score ?? 0) - (a.score ?? 0);
                })
                .slice(0, config.suggestions.total);

              logger.debug(`[최종정렬] 기존품목 우선 → 점수순`, { items: suggestions.map((s: any) => ({ no: s.item_no, score: s.score, isNew: s.is_new_item || false })) });

              // 🔍 디버깅: 첫 번째 항목이 기존 품목인지 확인
              if (suggestions.length > 0) {
                const first = suggestions[0];
                logger.debug(`[정렬검증] 1번 항목`, { item_no: first.item_no, is_new_item: first.is_new_item });
              }

              // ✅ 신규 품목 정보 저장 (resolved 재판단 후 반환)
              x.has_new_items = composition.newItems > 0;
              x.new_item_info = composition.newItems > 0 ? {
                message: '신규 품목이 포함되어 있습니다.',
                source: 'order-ai.xlsx (English)',
              } : undefined;
            }
          } else {
            logger.debug(`[신규품목] English 시트 결과 없음`, { showExisting: config.suggestions.total });
          }
        }
      }

      // ✅ LLM 리랭킹: 비활성화 (사전 확장으로 대부분 해결, 속도 우선)
      // 사전 확장 실패 + 점수 애매한 경우에만 리랭킹 (미래 활성화 가능)
      if (false && suggestions.length >= 2 && needsReranking(suggestions)) {
        try {
          const rerankResult = await rerankWithLLM(
            String(x.name || x.raw || ""),
            suggestions,
            {
              clientName: client?.client_name,
            }
          );
          if (rerankResult && rerankResult.confidence >= 0.5) {
            suggestions = rerankResult.reranked;
            logger.debug(`[LLM Rerank] 리랭킹 완료`, {
              name: x.name,
              best: suggestions[0]?.item_name,
              confidence: rerankResult.confidence,
              reason: rerankResult.reasoning,
            });
          }
        } catch (err) {
          logger.error(`[LLM Rerank] 오류 (무시)`, err);
        }
      }

      // ✅ 중복 제거 후 resolved 재판단
      let resolved = x?.resolved ?? false;

      // ✅ resolved인데 item_no가 없으면 무조건 false로 변경
      if (resolved && !x?.item_no) {
        logger.debug(`[AutoResolve] resolved=true인데 item_no 없음 → resolved=false`, { name: x.name });
        resolved = false;
        x = { ...x, resolved: false };  // x 객체도 업데이트
      }

      // 중복 제거된 suggestions로 다시 판단
      if (!resolved && suggestions.length > 0) {
        const top = suggestions[0];
        const second = suggestions[1];
        const gap = second ? (top.score ?? 0) - (second.score ?? 0) : 999;

        // ✅ 신규 품목은 자동 확정하지 않음
        const isNewItem = top.is_new_item ?? false;

        if (isNewItem) {
          // 신규 품목: 자동 확정 안 함
          resolved = false;
          logger.debug(`[AutoResolve] 신규품목 수동 확인 필요`, { name: x.name, score: top.score });
        } else {
          // 기존 품목: 자동 확정 조건
          const minScore = config.autoResolve?.minScore ?? 0.55;
          const minGap = config.autoResolve?.minGap ?? 0.10;
          const topScore = top.score ?? 0;

          // ⭐ 새 로직: 0.9점 이상이면 무조건 확정
          if (topScore >= 0.90) {
            resolved = true;
            logger.debug(`[AutoResolve] 고득점 확정`, { name: x.name, score: topScore });
          }
          // ⭐ 새 로직: 2위가 신규 품목이면 gap 무시하고 확정
          else if (second && (second.is_new_item ?? false)) {
            resolved = topScore >= minScore;
            logger.debug(`[AutoResolve] 2위 신규품목 → gap 무시`, { name: x.name, score: topScore, resolved });
          }
          // 기존 로직: 2위도 기존 품목이면 gap 체크
          else {
            resolved = top.item_no && topScore >= minScore && gap >= minGap;
            logger.debug(`[AutoResolve] 기존품목 gap 체크`, { name: x.name, score: topScore, gap, resolved });
          }
        }
      }

      // ✅ resolved가 true로 변경되었고, suggestions가 있으면 top item_no로 업데이트
      logger.debug(`[ITEM DEBUG] Before resultItem`, { name: x.name, resolved, x_item_no: x.item_no, suggestions_length: suggestions.length });

      const resultItem: any = {
        ...x,
        resolved,
        suggestions,
        candidates: suggestions, // ✅ 프론트엔드 호환성: candidates도 동일하게 설정
      };

      if (resolved && suggestions.length > 0 && suggestions[0].item_no) {
        logger.debug(`[ITEM DEBUG] Updating item_no`, { item_no: suggestions[0].item_no });
        resultItem.item_no = suggestions[0].item_no;
        resultItem.item_name = suggestions[0].item_name;
        resultItem.score = suggestions[0].score;
      }

      logger.debug(`[ITEM DEBUG] After resultItem`, { name: resultItem.name, resolved: resultItem.resolved, item_no: resultItem.item_no });

      return resultItem;
    }));

    // ✅ 같은 item_no를 가진 아이템 통합 (수량 합산)
    const mergedItems = (() => {
      const itemMap = new Map<string, any>();
      for (const item of itemsWithSuggestions) {
        logger.debug(`[MERGE DEBUG] Processing item`, { resolved: item.resolved, item_no: item.item_no, qty: item.qty });

        if (item.resolved && item.item_no) {
          const key = String(item.item_no);
          const existing = itemMap.get(key);
          if (existing) {
            // 같은 품목이 여러 번 확정된 경우 수량 합산
            logger.debug(`[MERGE DEBUG] 중복 발견 - 수량 합산`, { key, prev: existing.qty, add: item.qty });
            existing.qty = (existing.qty || 0) + (item.qty || 0);
          } else {
            logger.debug(`[MERGE DEBUG] 새 아이템 추가`, { key });
            itemMap.set(key, { ...item });
          }
        } else {
          // 미확정 아이템은 그대로 추가 (중복 체크 안 함)
          const unresolvedKey = `unresolved_${Date.now()}_${Math.random()}`;
          logger.debug(`[MERGE DEBUG] 미확정 아이템 추가`, { key: unresolvedKey });
          itemMap.set(unresolvedKey, { ...item });
        }
      }
      return Array.from(itemMap.values());
    })();

    logger.debug("[EXISTING CLIENT] mergedItems", { count: mergedItems.length });

    // 4) 상태 결정
    const hasUnresolved = mergedItems.some((x: any) => !x.resolved);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: mergedItems, // ✅ suggestions 포함된 배열 반환

      // ✅ 여기 핵심: suggestions가 들어간 배열을 내려줘야 UI에서 3개 옵션이 뜸
      items: mergedItems,

      // ✅ 직원 메시지는 기존과 동일하게 동작 (unresolved는 여전히 확인필요로 표기)
      staff_message: await formatStaffMessage(client, mergedItems, {
        customDeliveryDate: body?.customDeliveryDate,
        requirePaymentConfirm: body?.requirePaymentConfirm,
        requireInvoice: body?.requireInvoice,
      }),

      debug: {
        preprocessed_message: preMessage,
        translation_message: trMsg.translated ? "translated" : "no",
        preprocessed_orderText: orderPre,
        translation_order: trOrder.translated ? "translated" : "no",
      },
    } as any);
  } catch (e: any) {
    logger.error("[parse-full-order] ERROR", e);
    return jsonResponse(
      { success: false, error: String(e?.message || e) } as any,
      { status: 500 }
    );
  }
}
