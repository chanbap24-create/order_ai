import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { parseItemsFromMessage } from "@/app/lib/parseItems";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { syncFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";
import type { ParseFullOrderResponse } from "@/app/types/api";

import { preprocessMessage } from "./parse/preprocess";
import { splitClientAndOrder } from "./parse/utils";
import { resolveClient } from "./parse/resolveClient";
import { formatStaffMessage } from "./parse/formatStaffMessage";
import { buildSuggestionsForItem } from "./lib/buildSuggestions";

// GET 메소드 (API 상태 확인용)
export async function GET() {
  return jsonResponse({
    success: true,
    message: "parse-full-order API is running. Use POST method to parse orders.",
  });
}

export async function POST(req: Request): Promise<NextResponse<ParseFullOrderResponse>> {
  const sync = await syncFromXlsxIfNeeded();
  console.log("[XLSX SYNC]", sync);

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);
    const pageType = body?.type || "wine";

    // 0) 전체 메시지 전처리 + 번역
    const pre0 = preprocessMessage(body?.message ?? "");
    const trMsg = await translateOrderToKoreanIfNeeded(pre0);
    const preMessage = trMsg.translated ? trMsg.text : pre0;

    const { rawMessage, clientText, orderText } = splitClientAndOrder({
      ...body,
      message: preMessage,
    });

    // 1) 거래처 resolve
    const client = await resolveClient({ clientText, message: rawMessage, forceResolve });

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

    // 2) 품목 파싱 (orderText 재전처리 + 번역)
    const order0 = preprocessMessage(orderText || rawMessage);
    const trOrder = await translateOrderToKoreanIfNeeded(order0);
    const orderPre = trOrder.translated ? trOrder.text : order0;

    const parsedItems = parseItemsFromMessage(orderPre);

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

    // 3) 품목 resolve (조합 가중치)
    const resolvedItems = await resolveItemsByClientWeighted(clientCode, parsedItems, {
      minScore: 0.55,
      minGap: 0.05,
      topN: 5,
    });

    // 3-1) suggestions 부착 (병렬)
    const itemsWithSuggestions = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolvedItems.map((x: any) => buildSuggestionsForItem({ x, pageType, clientCode })),
    );

    // 4) 상태 결정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasUnresolved = itemsWithSuggestions.some((x: any) => !x.resolved);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client,
      parsed_items: parsedItems,
      items: itemsWithSuggestions,
      staff_message: await formatStaffMessage(client, itemsWithSuggestions, {
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
    return jsonResponse(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { success: false, error: String(e?.message || e) } as any,
      { status: 500 },
    );
  }
}
