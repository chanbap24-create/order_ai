import { logger } from "@/app/lib/logger";
import { cleanClientCode } from "./utils";
import { getDeliveryDateKST } from "./deliveryDate";

type FormatOptions = {
  customDeliveryDate?: string;
  requirePaymentConfirm?: boolean;
  requireInvoice?: boolean;
};

export async function formatStaffMessage(
  client: any,
  items: any[],
  options?: FormatOptions,
) {
  const delivery = await getDeliveryDateKST();
  const deliveryLabel = options?.customDeliveryDate || delivery.label;

  const lines: string[] = [];

  const clientName = String(client?.client_name || "미정").trim();
  const clientCode = client?.client_code ? cleanClientCode(client.client_code) : "미정";
  lines.push(`거래처: ${clientName} (${clientCode})`);
  lines.push(`배송 예정일: ${deliveryLabel}`);

  // 신규 사업자 정보
  if ((client as any).phone) lines.push(`연락처: ${(client as any).phone}`);
  if ((client as any).email) lines.push(`세금계산서: ${(client as any).email}`);

  lines.push("");

  // 발주 옵션
  if (options?.requirePaymentConfirm) lines.push("입금확인후 출고");
  if (options?.requireInvoice) lines.push("거래명세표 부탁드립니다");

  lines.push("");
  lines.push("품목:");

  for (const it of items) {
    const itemName = String(it.name || it.item_name || "").trim().toLowerCase();
    if (!itemName || itemName === "undefined" || itemName === "null"
      || it.name === undefined || it.name === null) {
      logger.debug('[formatStaffMessage] 무효 품목 스킵', {
        name: it.name, item_name: it.item_name, raw: it.raw,
      });
      continue;
    }

    if (it.resolved) {
      if (!it.item_no) {
        logger.debug('[formatStaffMessage] resolved이지만 item_no 없음, 스킵', {
          name: it.name, raw: it.raw,
        });
        continue;
      }

      // 한글 이름만 추출
      let koreanName = String(it.item_name || '');
      if (koreanName.includes(' / ')) {
        koreanName = koreanName.split(' / ')[0].trim();
      }
      koreanName = koreanName.replace(/\s*\([^)]*\)\s*/g, '').trim();
      koreanName = koreanName.replace(/^[A-Z]{1,3}\s+/, '');

      const priceInfo = it.unit_price_hint
        ? ` / ${it.unit_price_hint.toLocaleString()}원`
        : '';
      lines.push(`- ${it.item_no} / ${koreanName} / ${it.qty}병${priceInfo}`);
    } else {
      const priceInfo = it.unit_price_hint
        ? ` / ${it.unit_price_hint.toLocaleString()}원`
        : '';
      const displayName = it.name !== undefined && it.name !== null ? String(it.name) : "이름없음";
      lines.push(`- 확인필요 / "${displayName}" / ${it.qty}병${priceInfo}`);
    }
  }

  lines.push("");
  lines.push("발주 요청드립니다.");
  return lines.join("\n");
}
