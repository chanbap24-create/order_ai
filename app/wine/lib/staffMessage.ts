import { STAFF_MESSAGE } from "../constants";

export type StaffMessageOptions = {
  customDeliveryDate?: string;
  requirePaymentConfirm?: boolean;
  requireInvoice?: boolean;
};

/** 원본 직원 메시지에 배송일 치환 + 입금확인/거래명세표 삽입 */
export function decorateStaffMessage(
  original: string,
  opts: StaffMessageOptions = {},
): string {
  let msg = String(original ?? "");
  if (!msg) return msg;

  const deliveryDate = opts.customDeliveryDate?.trim();
  if (deliveryDate) {
    msg = msg.replace(
      STAFF_MESSAGE.deliveryDateLineRegex,
      `배송 예정일: ${deliveryDate}`,
    );
  }

  const additionalLines: string[] = [];
  if (opts.requirePaymentConfirm) additionalLines.push(STAFF_MESSAGE.paymentConfirm);
  if (opts.requireInvoice) additionalLines.push(STAFF_MESSAGE.invoiceRequest);
  if (additionalLines.length === 0) return msg;

  const insert = additionalLines.join("\n");
  if (msg.includes(STAFF_MESSAGE.orderClosing.replace(/\.$/, ""))) {
    return msg.replace(
      STAFF_MESSAGE.orderClosingRegex,
      `${insert}\n\n${STAFF_MESSAGE.orderClosing}`,
    );
  }
  return `${msg.trim()}\n\n${insert}\n\n${STAFF_MESSAGE.orderClosing}`;
}

/** 클립보드 복사 (fallback 포함) */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fallback
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
