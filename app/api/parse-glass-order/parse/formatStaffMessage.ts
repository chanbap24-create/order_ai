import { cleanClientCode } from "./utils";
import { getDeliveryDateKST } from "./deliveryDate";

/**
 * Glass 품목 단위 결정 (잔 vs 개).
 *  - 디캔터/박스/쇼핑백/클리너 등 → 개
 *  - RD코드 포함 → 잔
 *  - 레스토랑 → 잔
 *  - 숫자/숫자 코드 → 잔
 *  - 그 외 → 개
 */
function getGlassUnit(itemName: string): string {
  if (/디캔터|박스|쇼핑백|클리너|캐링백|세트|밸류팩|폴리싱|클로스|린넨|보틀\s*클리너/i.test(itemName)) {
    return "개";
  }

  const rdMatch = itemName.match(/RD\s+(\d{4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
  if (rdMatch) return "잔";

  if (/레스토랑/i.test(itemName)) return "잔";

  const codeOnly = itemName.match(/^0?\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?$/i);
  if (codeOnly) return "잔";

  return "개";
}

export async function formatStaffMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[],
  options?: {
    customDeliveryDate?: string;
    requirePaymentConfirm?: boolean;
    requireInvoice?: boolean;
  },
) {
  const delivery = await getDeliveryDateKST();
  const deliveryLabel = options?.customDeliveryDate || delivery.label;

  const lines: string[] = [];
  lines.push(`거래처: ${client.client_name} (${cleanClientCode(client.client_code)})`);
  lines.push(`배송 예정일: ${deliveryLabel}`);

  if (client.phone) lines.push(`연락처: ${client.phone}`);
  if (client.email) lines.push(`세금계산서: ${client.email}`);

  lines.push("");

  if (options?.requirePaymentConfirm) lines.push("입금확인후 출고");
  if (options?.requireInvoice) lines.push("거래명세표 부탁드립니다");

  lines.push("");
  lines.push("품목:");

  for (const it of items) {
    const unit = getGlassUnit(it.item_name || it.name || "");
    if (it.resolved) {
      lines.push(`- ${it.item_no} / ${it.item_name} / ${it.qty}${unit}`);
    } else {
      lines.push(`- 확인필요 / "${it.name}" / ${it.qty}${unit}`);
    }
  }

  lines.push("");
  lines.push("발주 요청드립니다.");
  return lines.join("\n");
}
