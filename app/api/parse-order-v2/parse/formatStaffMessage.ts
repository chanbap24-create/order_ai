import { cleanClientCode } from "./utils";
import { getDeliveryDateKST } from "./deliveryDate";

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
  lines.push("");

  if (options?.requirePaymentConfirm) {
    lines.push("입금확인후 출고");
  }
  if (options?.requireInvoice) {
    lines.push("거래명세표 부탁드립니다");
  }

  lines.push("");
  lines.push("품목:");

  for (const it of items) {
    if (it.resolved) {
      lines.push(`- ${it.item_no} / ${it.item_name} / ${it.qty}병`);
    } else {
      lines.push(`- 확인필요 / "${it.name}" / ${it.qty}병`);
    }
  }

  lines.push("");
  lines.push("발주 요청드립니다.");
  return lines.join("\n");
}
