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
  /** 품번(대문자) → 그 거래처 마지막 공급 단가. 할인율 미지정 시 이 가격이 우선 */
  historyPrices?: Record<string, number>;
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
  // DL(대유라이프) + 특이사항에 '입금확인' — 선결제 안내(계좌·품목별 금액·부가세 합계) 포맷
  if (p.tab === "DL" && /입금\s*확인/.test(p.deliveryNotes)) return buildPaymentFirstMessage(p);

  const greeting = "안녕하세요\n발주 감사합니다~";
  const deliveryLine = p.finalDeliveryLabel ? `배송 예정일: ${p.finalDeliveryLabel}` : "";

  const tastingItems: string[] = [];
  const lines = p.orderLines
    .map((ol, idx) => {
      const sel = getSelected(ol);
      const displayName = sel ? stripBrandPrefix(sel.item_name) : ol.query;
      const unit = sel ? getUnit(p.tab, sel.item_no, sel.item_name) : getUnit(p.tab, undefined, ol.query);
      // 할인율 100% = 시음주: 품목 목록에서 제외하고 아래 안내 문구로만 표기
      if ((p.discountRates[idx] || 0) === 100) {
        tastingItems.push(`${displayName} ${ol.quantity}${unit}`);
        return null;
      }
      if (!sel) {
        return `- ${ol.query} ${ol.quantity}${unit}`;
      }
      const stock = Number(sel.available_stock) || 0;
      // 품명+발주수량 한 줄, 재고는 다음 줄(들여쓰기)로 분리 — 수량/재고 혼동 방지
      return `- ${displayName} ${ol.quantity}${unit}\n  (재고 ${stock}${unit})`;
    })
    .filter((l): l is string => l !== null);

  // 시음주가 포함되면 안내 문구 추가
  const tastingMsg =
    tastingItems.length > 0
      ? `\n\n- ${tastingItems.join(", ")}\n시음용으로 보내드려요.\n부담 없이 한번 맛보시라고 드리는 거니 편하실 때 한번 테이스팅해 보세요.`
      : "";

  const head = [greeting, deliveryLine].filter(Boolean).join("\n\n");
  return `${head}\n\n${lines.join("\n")}${tastingMsg}\n\n좋은 하루 되세요!`;
}

/**
 * 대유라이프 입금확인후 출고 거래처용 — 결제 요청 메시지.
 * 품목별 공급가 * 수량 = 합계, 마지막에 부가세 포함 총액과 입금 계좌 안내.
 */
function buildPaymentFirstMessage(p: BuildParams): string {
  const lines: string[] = [];
  let total = 0;
  p.orderLines.forEach((ol, idx) => {
    const rate = p.discountRates[idx] || 0;
    if (rate === 100) return; // 시음주는 금액 안내에서 제외
    const sel = getSelected(ol);
    const displayName = sel ? stripBrandPrefix(sel.item_name) : ol.query;
    const unit = sel ? getUnit(p.tab, sel.item_no, sel.item_name) : getUnit(p.tab, undefined, ol.query);
    // 규칙: 할인율을 지정하면 정가에 할인 적용, 미지정이면 이전에 공급했던 단가 그대로
    const prev = sel ? p.historyPrices?.[sel.item_no.trim().toUpperCase()] : undefined;
    const price = rate > 0 ? getItemPrice(p.orderLines, p.discountRates, idx) : (prev ?? getItemPrice(p.orderLines, p.discountRates, idx));
    const sum = price * ol.quantity;
    total += sum;
    lines.push(
      `- ${displayName} ${ol.quantity}${unit}` +
      (price > 0 ? `\n${fmt(price)} * ${ol.quantity} = ${fmt(sum)}원` : ""),
    );
  });
  const vat = Math.round(total * 1.1);
  // 순서 = 받는 사람의 행동 순서: 품목 확인 → 총액 → 계좌(총액 바로 아래, 송금 동선) → 결제 시 배송일
  return [
    "안녕하세요\n발주 감사합니다.",
    "품목과 수량, 금액 확인 부탁드립니다.",
    lines.join("\n\n"),
    `부가세포함 = ${fmt(vat)}원`,
    "기업은행_(주)대유라이프  500-042529-01-016",
    p.finalDeliveryLabel
      ? `오늘까지 결제해 주시면 ${p.finalDeliveryLabel} 배송 예정입니다.`
      : "입금 확인 후 배송 일정 안내드리겠습니다.",
    "좋은 하루 되세요!",
  ].join("\n\n");
}
