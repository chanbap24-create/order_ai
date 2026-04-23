import { STAFF_MESSAGE } from "../constants";

export type StaffMessageOptions = {
  customDeliveryDate?: string;
  requirePaymentConfirm?: boolean;
  requireInvoice?: boolean;
};

/**
 * 원본 직원 메시지에 배송일 치환과 추가 문구(입금확인/거래명세표)를 적용한다.
 * - customDeliveryDate: "배송 예정일: …" 라인을 모두 치환
 * - requirePaymentConfirm / requireInvoice: "발주 요청드립니다." 앞에 삽입
 */
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

/** 브라우저 클립보드에 텍스트 복사 (fallback 포함) */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fallback for older browsers / insecure context
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}
