import { useState } from "react";

/**
 * 발주 옵션 상태 (배송일 지정 + 입금확인/거래명세표 체크).
 */
export function useOrderOptions() {
  const [customDeliveryDate, setCustomDeliveryDate] = useState("");
  const [requirePaymentConfirm, setRequirePaymentConfirm] = useState(false);
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const asApiFlags = () => ({
    customDeliveryDate: customDeliveryDate || undefined,
    requirePaymentConfirm: requirePaymentConfirm || undefined,
    requireInvoice: requireInvoice || undefined,
  });

  return {
    customDeliveryDate,
    setCustomDeliveryDate,
    requirePaymentConfirm,
    setRequirePaymentConfirm,
    requireInvoice,
    setRequireInvoice,
    panelOpen,
    setPanelOpen,
    asApiFlags,
  };
}
