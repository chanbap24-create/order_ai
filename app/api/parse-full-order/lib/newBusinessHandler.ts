import { parseItemsFromMessage } from "@/app/lib/parseItems";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { translateOrderToKoreanIfNeeded } from "@/app/lib/translateOrder";
import { logger } from "@/app/lib/logger";
import { preExpandAbbreviationsInMessage, preprocessMessage } from "../parse/preprocess";
import { formatStaffMessage } from "../parse/formatStaffMessage";
import { mergeResolvedItems } from "./mergeItems";

type NewBusinessInput = { name: string; phone: string; email?: string };

type Body = {
  message?: string;
  customDeliveryDate?: string;
  requirePaymentConfirm?: boolean;
  requireInvoice?: boolean;
};

/**
 * 신규 사업자(거래처 이력 없음) 품목 파싱 파이프라인.
 * master_items에서만 검색 → suggestions 포함 결과 반환.
 */
export async function handleNewBusiness(newBusiness: NewBusinessInput, body: Body) {
  logger.debug("[NEW BUSINESS]", { newBusiness });

  // 품목 파싱
  const pre0 = preprocessMessage(body?.message ?? "");
  const pre0Expanded = preExpandAbbreviationsInMessage(pre0);
  const trMsg = await translateOrderToKoreanIfNeeded(pre0Expanded);
  const preMessage = trMsg.translated ? trMsg.text : pre0Expanded;

  const parsedItems = parseItemsFromMessage(preMessage).filter((item) => {
    const name = String(item.name || "").trim().toLowerCase();
    if (name === "undefined" || name === "null" || name === "") {
      logger.debug(`[FILTER] 무효 입력 제거`, { raw: item.raw });
      return false;
    }
    return true;
  });

  const client = {
    status: "resolved" as const,
    client_name: newBusiness.name,
    client_code: "NEW",
    phone: newBusiness.phone,
    email: newBusiness.email,
  };

  logger.debug("[NEW BUSINESS] Calling resolveItemsByClientWeighted", { itemCount: parsedItems.length });

  const resolvedItems = await resolveItemsByClientWeighted("NEW", parsedItems, {
    minScore: 0.55,
    minGap: 0.05,
    topN: 10,
  });

  logger.debug("[NEW BUSINESS] resolvedItems", { count: resolvedItems.length });

  // 확정/미확정 모두 candidates → suggestions 변환
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsWithSuggestions = resolvedItems.map((it: any) => {
    const candidates = it.candidates || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suggestions = candidates.slice(0, 10).map((c: any) => ({
      ...c,
      score: c.score ?? 0,
      supply_price: c.supply_price,
    }));
    return { ...it, suggestions };
  });

  const mergedItems = mergeResolvedItems(itemsWithSuggestions);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allResolved = mergedItems.every((it: any) => it.resolved);

  logger.debug("[NEW BUSINESS] Calling formatStaffMessage");
  const staffMessage = await formatStaffMessage(
    client,
    mergedItems,
    {
      customDeliveryDate: body?.customDeliveryDate,
      requirePaymentConfirm: body?.requirePaymentConfirm,
      requireInvoice: body?.requireInvoice,
    },
  );

  return {
    client,
    mergedItems,
    staffMessage,
    allResolved,
  };
}
