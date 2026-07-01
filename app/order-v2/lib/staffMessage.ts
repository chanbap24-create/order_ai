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

/** 품명 앞 생산자 약어 코드(예: "RO ", "LM ", "BL ") 제거 — 거래처 전달용. */
function stripBrandPrefix(name: string): string {
  return (name || "").replace(/^[A-Z]{2,3}\s+/, "").trim() || name;
}

/**
 * 거래처에 전달할 카톡 메시지(붙여넣기용).
 * 직원 메시지와 달리 품번·가격은 빼고, 인사 + 배송예정일 + (품목/수량/가용재고)만.
 * 품명 앞 약어는 제거. 재고는 가용재고(available_stock) 기준.
 */
export function buildClientMessage(p: BuildParams): string {
  if (p.orderLines.length === 0) return "";

  const greeting = "안녕하세요\n발주 감사합니다~";
  const deliveryLine = p.finalDeliveryLabel ? `배송 예정일: ${p.finalDeliveryLabel}` : "";

  const lines = p.orderLines.map((ol, idx) => {
    const sel = getSelected(ol);
    // 할인율 100% = 시음주 (직원 메시지와 동일 규칙)
    const tastingTag = (p.discountRates[idx] || 0) === 100 ? " (시음주)" : "";
    if (!sel) {
      const unit = getUnit(p.tab, undefined, ol.query);
      return `- ${ol.query} ${ol.quantity}${unit}${tastingTag}`;
    }
    const unit = getUnit(p.tab, sel.item_no, sel.item_name);
    const stock = Number(sel.available_stock) || 0;
    // 품명+발주수량 한 줄, 재고는 다음 줄(들여쓰기)로 분리 — 수량/재고 혼동 방지
    return `- ${stripBrandPrefix(sel.item_name)} ${ol.quantity}${unit}${tastingTag}\n  (재고 ${stock}${unit})`;
  });

  const head = [greeting, deliveryLine].filter(Boolean).join("\n\n");
  return `${head}\n\n${lines.join("\n")}\n\n좋은 하루 되세요!`;
}
