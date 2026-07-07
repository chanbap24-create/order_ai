import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { parseItemsFromMessage } from "@/app/lib/parseItems";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { syncFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";
import { jsonResponse } from "@/app/lib/api-response";
import type { ParseFullOrderResponse } from "@/app/types/api";
import { logger } from "@/app/lib/logger";

// 추출 모듈 (parse/)
import { preExpandAbbreviationsInMessage, preprocessMessage } from "./parse/preprocess";
import { splitClientAndOrder } from "./parse/utils";
import { resolveClient } from "./parse/resolveClient";
import { formatStaffMessage } from "./parse/formatStaffMessage";

// phase 모듈 (lib/)
import { runLlmPreExpand } from "./lib/llmPreExpand";
import { runBrandMatch } from "./lib/brandMatch";
import { runLlmExpandRetry } from "./lib/llmExpandRetry";
import { buildSuggestionsForItem } from "./lib/buildSuggestions";
import { mergeResolvedItems } from "./lib/mergeItems";
import { handleNewBusiness } from "./lib/newBusinessHandler";

// GET 메소드 (API 상태 확인용)
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const xlsxPath = path.join(process.cwd(), 'order-ai.xlsx');
  const xlsxExists = fs.existsSync(xlsxPath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let xlsxInfo: any = null;
  if (xlsxExists) {
    const stats = fs.statSync(xlsxPath);
    xlsxInfo = {
      exists: true,
      size: stats.size,
      modified: stats.mtime,
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadMasterSheet } = require('@/app/lib/masterSheet');
      const items = loadMasterSheet();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sample = items.find((item: any) => item.itemNo === '3022042');
      xlsxInfo.sampleItem = sample || 'not found';
      xlsxInfo.totalItems = items.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      lastUpdated: "2026-02-02T04:45:00Z",
    },
    excel: xlsxInfo || { exists: false, path: xlsxPath },
  });
}

export async function POST(req: Request): Promise<NextResponse<ParseFullOrderResponse>> {
  const sync = await syncFromXlsxIfNeeded();
  logger.debug("[XLSX SYNC]", { result: sync });

  try {
    const body = await req.json().catch(() => ({}));
    // LLM 비용/지연 증폭 방지 — 발주 메시지 길이 상한(order-v2/parse 와 동일 기준)
    if (typeof body?.message === "string" && body.message.length > 5000) {
      return jsonResponse({ success: false, status: "error", error: "메시지가 너무 깁니다. (최대 5000자)" } as never);
    }
    const forceResolve = Boolean(body?.force_resolve);
    const pageType = body?.type || "wine";

    // 신규 사업자 처리
    const newBusiness = body?.newBusiness;
    if (newBusiness && newBusiness.name && newBusiness.phone) {
      const { client, mergedItems, staffMessage, allResolved } = await handleNewBusiness(newBusiness, body);
      return jsonResponse({
        success: true,
        status: allResolved ? "resolved" : "needs_review_items",
        client,
        parsed_items: mergedItems,
        items: mergedItems,
        staff_message: staffMessage,
        is_new_business: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }

    // 0) 전체 메시지 전처리 + 번역
    const pre0 = preprocessMessage(body?.message ?? "");
    const pre0Expanded = preExpandAbbreviationsInMessage(pre0);
    const trMsg = await translateOrderToKoreanIfNeeded(pre0Expanded);
    const preMessage = trMsg.translated ? trMsg.text : pre0Expanded;

    const { rawMessage, clientText, orderText } = splitClientAndOrder({
      ...body,
      message: preMessage,
    });

    // 1) 거래처 resolve
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;
    if (body?.resolvedClientCode && body?.resolvedClientName) {
      logger.debug("[CLIENT] frontend resolved", { code: body.resolvedClientCode, name: body.resolvedClientName });
      client = {
        status: "resolved" as const,
        client_code: String(body.resolvedClientCode),
        client_name: String(body.resolvedClientName),
        method: "frontend_resolved",
      };
    } else {
      client = await resolveClient({ clientText, message: rawMessage, forceResolve });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }

    // 2) 품목 파싱
    const order0 = preprocessMessage(
      body?.resolvedClientCode ? rawMessage : (orderText || rawMessage),
    );
    const order0Expanded = preExpandAbbreviationsInMessage(order0);
    const trOrder = await translateOrderToKoreanIfNeeded(order0Expanded);
    const orderPre = trOrder.translated ? trOrder.text : order0Expanded;

    const parsedItems = parseItemsFromMessage(orderPre).filter((item) => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }

    // 2-2) LLM 사전 확장 (배치)
    if (pageType === "wine" && process.env.ANTHROPIC_API_KEY) {
      await runLlmPreExpand(parsedItems);
    }

    // 3-0) 브랜드 우선 매칭 (Wine만)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let brandMatchedItems: any[] = [];
    if (pageType === "wine") {
      brandMatchedItems = await runBrandMatch(parsedItems);
    }

    // 3) 가중치 매칭 (브랜드 매칭 미스만)
    const itemsToResolve = brandMatchedItems.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? parsedItems.map((item: any, idx: number) => ({ ...item, _originalIndex: idx }))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((item: any) => !brandMatchedItems.some((bm) => bm.name === item.name))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : parsedItems.map((item: any, idx: number) => ({ ...item, _originalIndex: idx }));

    logger.debug(`[품목 resolve]`, {
      total: parsedItems.length,
      brandMatched: brandMatchedItems.length,
      fallback: itemsToResolve.length,
    });

    let resolvedItems = itemsToResolve.length > 0
      ? await resolveItemsByClientWeighted(clientCode, itemsToResolve, {
          minScore: 0.55,
          minGap: 0.05,
          topN: 5,
        })
      : [];

    // 3-5) LLM 사후 확장 (점수 <0.5 재시도)
    if (resolvedItems.length > 0 && process.env.ANTHROPIC_API_KEY) {
      resolvedItems = await runLlmExpandRetry(resolvedItems, clientCode);
    }

    // 브랜드 매칭 + 가중치 매칭 병합 → 원본 순서
    const allResolvedItems = [...brandMatchedItems, ...resolvedItems]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a._originalIndex ?? 0) - (b._originalIndex ?? 0));

    // 3-1) 거래처 이력 조회 (is_new_item 판단용)
    const { data: clientHistoryRows } = await supabase
      .from("client_item_stats")
      .select("item_no")
      .eq("client_code", clientCode);

    const clientItemSet = new Set((clientHistoryRows || []).map((r) => String(r.item_no)));
    logger.debug(`[거래처이력]`, { clientCode, itemCount: clientItemSet.size });

    // 각 품목 suggestions 빌드 (병렬)
    const itemsWithSuggestions = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allResolvedItems.map((x: any) => buildSuggestionsForItem({ x, clientItemSet, pageType, clientCode })),
    );

    // 수량 합산 (중복 item_no)
    const mergedItems = mergeResolvedItems(itemsWithSuggestions);
    logger.debug("[EXISTING CLIENT] mergedItems", { count: mergedItems.length });

    // 4) 상태 결정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasUnresolved = mergedItems.some((x: any) => !x.resolved);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: mergedItems,
      items: mergedItems,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    logger.error("[parse-full-order] ERROR", e);
    return jsonResponse(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { success: false, error: String(e?.message || e) } as any,
      { status: 500 },
    );
  }
}
