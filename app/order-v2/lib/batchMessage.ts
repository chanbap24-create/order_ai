import type { BatchOrder, OrderTab } from "../types";
import { buildStaffMessage } from "./staffMessage";

/** 배치 카드 1건 → 단톡방 직원메시지 (기존 포맷 재사용, 할인/배송일 기본값) */
export function buildBatchMessage(o: BatchOrder, tab: OrderTab): string {
  return buildStaffMessage({
    orderLines: o.orderLines,
    tab,
    selectedClient: o.client,
    clientQuery: o.clientHint,
    discountRates: {},
    historySet: o.historySet,
    finalDeliveryLabel: "",
    deliveryNotes: "",
  });
}

/** ready/needs_review 인 모든 카드를 한 번에 복사할 텍스트 (거래처별 구분) */
export function buildBatchAllMessage(orders: BatchOrder[], tab: OrderTab): string {
  return orders
    .filter((o) => o.orderLines.length > 0)
    .map((o) => buildBatchMessage(o, tab))
    .join("\n\n──────────\n\n");
}
