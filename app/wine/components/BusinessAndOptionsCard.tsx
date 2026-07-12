"use client";

import { WINE_COLORS } from "../constants";
import { NewBusinessForm, type NewBusinessFormProps } from "./NewBusinessForm";
import { OrderOptionsPanel, type OrderOptionsPanelProps } from "./OrderOptionsPanel";

type Props = {
  newBusiness: NewBusinessFormProps;
  orderOptions: OrderOptionsPanelProps;
};

/** 신규 사업자 폼 + 발주 옵션 패널을 묶는 카드 래퍼 */
export function BusinessAndOptionsCard({ newBusiness, orderOptions }: Props) {
  return (
    <div
      style={{
        marginTop: 12,
        background: WINE_COLORS.surface,
        borderRadius: 12,
        border: `1px solid ${WINE_COLORS.dividerCard}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        overflow: "hidden",
      }}
    >
      <NewBusinessForm {...newBusiness} />
      <OrderOptionsPanel {...orderOptions} />
    </div>
  );
}
