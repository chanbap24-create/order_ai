import type { Client, OrderLine, OrderTab } from "../types";
import { fmt } from "./format";
import { getSelected, getItemPrice } from "./priceCalc";
import { getUnit } from "./unitRules";

type BuildParams = {
  orderLines: OrderLine[];
  tab: OrderTab;
  selectedClient: Client | null;
  clientQuery: string;
  discountRates: Record<number, number>;
  historySet: Set<string>;
  /** 예: "10/15(수)" 또는 빈 문자열 */
  finalDeliveryLabel: string;
  deliveryNotes: string;
};

/**
 * 직원에게 전달할 발주 메시지 빌더.
 * 포맷:
 *   [거래처명]
 *   배송 예정일: M/D(요일)
 *   특이사항...
 *
 *   - 품번 / 품명 / 수량단위(/ 가격)
 *   ...
 *
 *   발주 요청드립니다.
 *
 * 가격 표기 규칙:
 * - 할인율 100% → "시음주"
 * - 할인율 > 0  → "가격 (N%↓)"
 * - 구매이력 없고 공급가 > 0 → 공급가 표시
 * - 그 외 → 생략
 */
export function buildStaffMessage(p: BuildParams): string {
  if (p.orderLines.length === 0) return "";

  const name = p.selectedClient?.client_name || p.clientQuery || "(미지정)";
  const deliveryLine = p.finalDeliveryLabel ? `배송 예정일: ${p.finalDeliveryLabel}` : "";

  const lines = p.orderLines.map((ol, idx) => {
    const sel = getSelected(ol);
    if (!sel) {
      return `- (미선택) / ${ol.query} / ${ol.quantity}${getUnit(p.tab, undefined, ol.query)}`;
    }
    const rate = p.discountRates[idx] || 0;
    const price = getItemPrice(p.orderLines, p.discountRates, idx);
    const hasHistory = p.historySet.has(sel.item_no.trim().toUpperCase());

    const pricePart =
      rate === 100
        ? " / 시음주"
        : rate > 0
          ? ` / ${fmt(price)} (${rate}%↓)`
          : !hasHistory && sel.supply_price > 0
            ? ` / ${fmt(sel.supply_price)}`
            : "";

    return `- ${sel.item_no} / ${sel.item_name} / ${ol.quantity}${getUnit(p.tab, sel.item_no, sel.item_name)}${pricePart}`;
  });

  const notesLine = p.deliveryNotes.trim() ? `\n${p.deliveryNotes.trim()}\n` : "";
  return `[${name}]\n${deliveryLine ? deliveryLine + "\n" : ""}${notesLine}\n${lines.join("\n")}\n\n발주 요청드립니다.`;
}
