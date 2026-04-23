import { jsonResponse } from "@/app/lib/api-response";
import { parseGlassItemsFromMessage } from "@/app/lib/parseGlassItems";
import { resolveGlassItemsByClient } from "@/app/lib/resolveGlassItems";
import { syncFromXlsxIfNeeded, syncGlassFromXlsxIfNeeded } from "@/app/lib/syncFromXlsx";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";

import { preprocessGlassMessage } from "./parse/preprocess";
import { norm, splitClientAndOrder } from "./parse/utils";
import { resolveClient } from "./parse/resolveClient";
import { formatStaffMessage } from "./parse/formatStaffMessage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachSuggestions(resolvedItems: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return resolvedItems.map((x: any) => {
    if (x?.resolved) return x;
    const suggestions = Array.isArray(x?.suggestions)
      ? x.suggestions
      : Array.isArray(x?.candidates)
        ? x.candidates.slice(0, 3)
        : [];
    return { ...x, suggestions };
  });
}

/**
 * 거래처명이 첫 품목 라인에 섞여 있으면 제거.
 * (Glass 입력은 "거래처 0330/07 3" 같이 한 줄로 오는 경우가 많음)
 */
function stripClientNameFromOrder(order: string, clientName: string): string {
  if (!clientName) return order;
  const clientNorm = norm(clientName);

  return order
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith(clientName)) {
        return trimmed.slice(clientName.length).trim();
      }
      if (norm(trimmed) === clientNorm) return "";

      const lineTokens = trimmed.split(/\s+/);
      if (lineTokens.length > 1) {
        if (lineTokens.length > 2) {
          const twoTokens = lineTokens.slice(0, 2).join(" ");
          const twoTokenNorm = norm(twoTokens);
          if (twoTokenNorm === clientNorm || clientNorm.includes(twoTokenNorm) || twoTokenNorm.includes(clientNorm)) {
            return lineTokens.slice(2).join(" ");
          }
        }
        const firstToken = lineTokens[0];
        if (norm(firstToken) === clientNorm || clientNorm.includes(norm(firstToken)) || norm(firstToken).includes(clientNorm)) {
          return lineTokens.slice(1).join(" ");
        }
      }
      return trimmed;
    })
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const sync = await syncFromXlsxIfNeeded();
  const glassSync = await syncGlassFromXlsxIfNeeded();
  console.log("[XLSX SYNC]", sync, "[GLASS SYNC]", glassSync);

  try {
    const body = await req.json().catch(() => ({}));
    const forceResolve = Boolean(body?.force_resolve);

    // 신규 사업자 처리
    const newBusiness = body?.newBusiness;
    if (newBusiness && newBusiness.name && newBusiness.phone) {
      console.log("[NEW BUSINESS]", newBusiness);

      const pre0 = preprocessGlassMessage(body?.message ?? "");
      const trMsg = await translateOrderToKoreanIfNeeded(pre0);
      const preMessage = trMsg.translated ? trMsg.text : pre0;
      const parsedItems = parseGlassItemsFromMessage(preMessage);

      const client = {
        status: "resolved" as const,
        client_name: newBusiness.name,
        client_code: "NEW",
        phone: newBusiness.phone,
        email: newBusiness.email,
      };

      const resolvedItems = await resolveGlassItemsByClient("NEW", parsedItems, {
        minScore: 0.55, minGap: 0.05, topN: 5,
      });

      const itemsWithSuggestions = attachSuggestions(resolvedItems);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasUnresolved = itemsWithSuggestions.some((x: any) => !x.resolved);

      const staffMessage = await formatStaffMessage(client, itemsWithSuggestions, {
        customDeliveryDate: body?.customDeliveryDate,
        requirePaymentConfirm: body?.requirePaymentConfirm,
        requireInvoice: body?.requireInvoice,
      });

      return jsonResponse({
        success: true,
        status: hasUnresolved ? "needs_review_items" : "resolved",
        client,
        parsed_items: parsedItems,
        items: itemsWithSuggestions,
        staff_message: staffMessage,
        is_new_business: true,
      });
    }

    // 0) 메시지 전처리 + 번역
    const pre0 = preprocessGlassMessage(body?.message ?? "");
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
      });
    }

    // 2) 품목 파싱
    console.log(`[Glass DEBUG] orderText="${orderText}", rawMessage="${rawMessage.substring(0, 50)}"`);
    let order0 = preprocessGlassMessage(orderText || rawMessage);
    console.log(`[Glass DEBUG] order0 after preprocess="${order0}"`);

    // 거래처명이 품목 라인에 섞여있으면 제거
    if (client.status === "resolved" && client.client_name) {
      order0 = stripClientNameFromOrder(order0, String(client.client_name));
      console.log(`[Glass] 거래처명 제거 후 orderText: "${order0}"`);
    }

    const trOrder = await translateOrderToKoreanIfNeeded(order0);
    const orderPre = trOrder.translated ? trOrder.text : order0;

    const parsedItems = parseGlassItemsFromMessage(orderPre);

    const clientCode = client?.client_code;
    if (!clientCode) {
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client,
        error: "client_code가 없어 품목 resolve를 진행할 수 없습니다.",
      });
    }

    // 3) 품목 resolve
    const resolvedItems = await resolveGlassItemsByClient(clientCode, parsedItems, {
      minScore: 0.55, minGap: 0.05, topN: 5,
    });

    const itemsWithSuggestions = attachSuggestions(resolvedItems);

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
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
