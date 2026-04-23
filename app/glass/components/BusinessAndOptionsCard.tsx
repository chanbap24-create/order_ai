"use client";

import { GLASS_COLORS } from "../constants";
import { NewBusinessForm, type NewBusinessFormProps } from "./NewBusinessForm";
import { OrderOptionsPanel, type OrderOptionsPanelProps } from "./OrderOptionsPanel";

type Props = {
  newBusiness: NewBusinessFormProps;
  orderOptions: OrderOptionsPanelProps;
};

/**
 * 신규 사업자 폼 + 발주 옵션 패널을 하나의 카드로 묶는 레이아웃 래퍼.
 */
export function BusinessAndOptionsCard({ newBusiness, orderOptions }: Props) {
  return (
    <div
      style={{
        marginTop: 12,
        background: GLASS_COLORS.surface,
        borderRadius: 16,
        border: `1px solid ${GLASS_COLORS.dividerCard}`,
        boxShadow: "0 1px 4px rgba(90,21,21,0.02)",
        overflow: "hidden",
      }}
    >
      <NewBusinessForm {...newBusiness} />
      <OrderOptionsPanel {...orderOptions} />
    </div>
  );
}
