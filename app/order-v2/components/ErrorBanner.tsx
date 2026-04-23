"use client";

import { ORDER_COLORS } from "../constants";

type Props = { error: string };

/** 파싱 에러 배너 */
export function ErrorBanner({ error }: Props) {
  if (!error) return null;
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        marginBottom: 16,
        background: "rgba(220,38,38,0.04)",
        border: "1px solid rgba(220,38,38,0.1)",
        color: ORDER_COLORS.confNone,
        fontSize: 13,
        fontWeight: 500,
        animation: "orderSlideIn 0.2s ease",
      }}
    >
      {error}
    </div>
  );
}
